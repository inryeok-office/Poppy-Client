import { afterEach, describe, expect, it } from 'vitest';

import type { SerializedBlockProgram } from '@/features/simulation';

import { cancelExecution, requestExecution } from '../api/executionApi';
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
