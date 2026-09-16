import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import type { SerializedBlockProgram } from '@/features/simulation';
import { server } from '@/shared/api/msw/server';

import { cancelExecution, getExecutionState, requestExecution } from '../api/executionApi';
import { __resetExecutionMocks } from '../api/mocks';
import type { ExecutionState } from '../model/types';
import { subscribeExecutionState } from './executionStream';

// start·greet·end 뿐이라 이동 거리 0 — 안전 구역·구조 검증을 항상 통과한다.
const runnableProgram: SerializedBlockProgram = {
  chain: [
    { id: 'start-0', kind: 'start' },
    { id: 'greet-0', kind: 'greet' },
    { id: 'end-0', kind: 'end' },
  ],
  detached: [],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => __resetExecutionMocks());

describe('subscribeExecutionState (SSE, 명세 Execution "실행 상태 전달")', () => {
  it('연결하면 곧바로 현재 상태부터 받는다 (재연결 시 "현재 상태를 다시 조회"를 만족)', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    const received: ExecutionState[] = [];
    const unsubscribe = subscribeExecutionState(executionId, (state) => received.push(state));

    await wait(150);
    unsubscribe();

    expect(received[0]?.status).toBe('queued');
  });

  it('상태가 바뀔 때마다 push 로 알려준다 (대기→배정→진행→완료)', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    const statuses: string[] = [];
    const unsubscribe = subscribeExecutionState(executionId, (state) =>
      statuses.push(state.status),
    );

    await wait(2700);
    unsubscribe();

    expect(statuses).toEqual(['queued', 'assigned', 'running', 'completed']);
  });

  it('완료(종료 상태)에 닿으면 서버가 스트림을 닫고, 구독 해제는 조용히 끝난다', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    const unsubscribe = subscribeExecutionState(executionId, () => {});

    await wait(2700);

    expect(() => unsubscribe()).not.toThrow();
  });

  it('취소되면(QUEUED 중) 취소 프레임을 받고 스트림이 끝난다', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    const statuses: string[] = [];
    const unsubscribe = subscribeExecutionState(executionId, (state) =>
      statuses.push(state.status),
    );

    // 취소는 REST 엔드포인트로 — 스트림은 executions 저장소를 관찰만 한다.
    await wait(50);
    await cancelExecution(executionId);
    await wait(150);
    unsubscribe();

    expect(statuses).toEqual(['queued', 'cancelled']);
  });
});

describe('subscribeExecutionState — 코드리뷰 반영 (inryeok-bot)', () => {
  const sseFrame = (state: ExecutionState, sep = '\n\n') => `data: ${JSON.stringify(state)}${sep}`;
  const streamOf = (...frames: string[]) =>
    new HttpResponse(
      new ReadableStream({
        start(controller) {
          for (const frame of frames) controller.enqueue(new TextEncoder().encode(frame));
          controller.close();
        },
      }),
      { headers: { 'Content-Type': 'text/event-stream' } },
    );

  it('종료 상태 없이 스트림이 그냥 끊기면(EOF) 재연결한다 (HIGH: EOF를 끝난 것으로 착각하면 안 됨)', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    let connectionCount = 0;
    server.use(
      http.get('*/api/executions/:id/stream', () => {
        connectionCount += 1;
        // 첫 연결은 아무 프레임도 없이 곧바로 끊는다 — keep-alive 제한 등으로 인한 비정상 EOF.
        if (connectionCount === 1) return streamOf();
        // 두 번째 연결부터는 정상적으로 현재 상태를 보낸다.
        return streamOf(
          sseFrame({
            executionId,
            status: 'queued',
            missionCleared: null,
            elapsedSec: null,
            message: null,
          }),
        );
      }),
    );

    const statuses: string[] = [];
    const unsubscribe = subscribeExecutionState(executionId, (state) =>
      statuses.push(state.status),
    );
    await wait(700); // 500ms 백오프 이후 재연결까지 기다린다
    unsubscribe();

    expect(connectionCount).toBeGreaterThanOrEqual(2);
    expect(statuses).toContain('queued');
  });

  it('CRLF 로 프레임을 보내는 서버도 정상 파싱한다 (API_CONTRACT)', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    server.use(
      http.get('*/api/executions/:id/stream', () =>
        streamOf(
          sseFrame(
            {
              executionId,
              status: 'running',
              missionCleared: null,
              elapsedSec: null,
              message: null,
            },
            '\r\n\r\n',
          ),
        ),
      ),
    );

    const received: string[] = [];
    const unsubscribe = subscribeExecutionState(executionId, (state) =>
      received.push(state.status),
    );
    await wait(150);
    unsubscribe();

    expect(received).toEqual(['running']);
  });

  it('404 같은 복구 불가능한 응답은 재시도하지 않는다 (ERROR_HANDLING)', async () => {
    let attempts = 0;
    server.use(
      http.get('*/api/executions/:id/stream', () => {
        attempts += 1;
        return new HttpResponse(null, { status: 404 });
      }),
    );

    const unsubscribe = subscribeExecutionState('nonexistent-id', () => {});
    await wait(1200); // 재시도했다면 500ms 지점에서 최소 한 번 더 시도했을 시간
    unsubscribe();

    expect(attempts).toBe(1);
  });

  it('이미 완료된 실행에 뒤늦게 연결해도 완료 프레임 하나만 받고 스트림이 곧바로 닫힌다 (RESOURCE_LEAK)', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    await wait(2500);
    expect((await getExecutionState(executionId)).status).toBe('completed');

    const response = await fetch(`/api/executions/${executionId}/stream`);
    const reader = response.body!.getReader();
    const first = await reader.read();
    const second = await reader.read();

    expect(first.done).toBe(false);
    expect(second.done).toBe(true);
  });
});
