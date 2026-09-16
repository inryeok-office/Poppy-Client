import { HttpResponse, delay, http } from 'msw';

import { evaluateProgram, type SerializedBlockProgram } from '@/features/simulation';
import type { ApiResponse } from '@/shared/api';

import { isCancellableStatus, isTerminalStatus } from '../model/types';
import type { ExecutionState, ExecutionStatus, RequestExecutionRequest } from '../model/types';

/** 상태가 바뀔 때마다 SSE 프레임을 얼마나 자주 확인해 보낼지 (명세 "SSE" — 서버 측 폴링
 *  간격일 뿐, 클라이언트는 push 로만 받는다. 짧게 잡아 타임라인 전환을 놓치지 않게 한다). */
const STREAM_CHECK_MS = 100;

// 백엔드(Poppy-Server) 전 임시 mock.
// 실행은 요청 시각으로부터의 경과 시간으로 대기 → 배정 → 진행 → 완료 순으로 흘러간다.
// 취소되면 즉시 cancelled.
const TIMELINE_MS = { assigned: 500, running: 1100, completed: 2400 } as const;

type MockExecution = {
  requestedAt: number;
  program: SerializedBlockProgram;
  cancelledAt: number | null;
};

const executions = new Map<string, MockExecution>();

function statusOf(execution: MockExecution): ExecutionStatus {
  if (execution.cancelledAt !== null) return 'cancelled';
  const elapsed = Date.now() - execution.requestedAt;
  if (elapsed < TIMELINE_MS.assigned) return 'queued';
  if (elapsed < TIMELINE_MS.running) return 'assigned';
  if (elapsed < TIMELINE_MS.completed) return 'running';
  return 'completed';
}

function stateOf(executionId: string, execution: MockExecution): ExecutionState {
  const status = statusOf(execution);
  const done = status === 'completed';
  return {
    executionId,
    status,
    missionCleared: done ? true : null,
    elapsedSec: done ? Math.round(TIMELINE_MS.completed / 1000) : null,
    message: done ? '로봇이 프로그램대로 잘 움직였어요.' : null,
  };
}

export const executionHandlers = [
  http.post('*/api/executions', async ({ request }) => {
    const { program } = (await request.json()) as RequestExecutionRequest;
    await delay(300);

    // 통과 기록 확인 — 클라이언트를 신뢰하지 않고 서버가 프로그램을 재검증한다 (명세).
    if (!evaluateProgram(program).runnable) {
      return HttpResponse.json<ApiResponse<never>>({ success: false } as ApiResponse<never>, {
        status: 422,
      });
    }

    const executionId = crypto.randomUUID();
    executions.set(executionId, { requestedAt: Date.now(), program, cancelledAt: null });
    return HttpResponse.json<ApiResponse<{ executionId: string }>>({
      success: true,
      data: { executionId },
    });
  }),

  http.get('*/api/executions/:executionId', ({ params }) => {
    const executionId = String(params.executionId);
    const execution = executions.get(executionId);
    if (!execution) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json<ApiResponse<ExecutionState>>({
      success: true,
      data: stateOf(executionId, execution),
    });
  }),

  http.post('*/api/executions/:executionId/cancel', ({ params }) => {
    const executionId = String(params.executionId);
    const execution = executions.get(executionId);
    if (!execution) return new HttpResponse(null, { status: 404 });
    // 명세: 체험자는 QUEUED·ASSIGNED 에서만 취소할 수 있다. RUNNING 이후 중지는 관리자
    // 기능이라 이 체험자용 엔드포인트에서는 상태를 바꾸지 않고 현재 상태 그대로 응답한다.
    if (isCancellableStatus(statusOf(execution))) {
      execution.cancelledAt = Date.now();
    }
    return HttpResponse.json<ApiResponse<ExecutionState>>({
      success: true,
      data: stateOf(executionId, execution),
    });
  }),

  // 명세 Execution "실행 상태 전달": "Server → Web 실시간 갱신은 SSE를 사용한다." 연결하면
  // 곧바로 현재 상태부터 보내고(재연결 시 "현재 상태를 다시 조회"를 만족), 이후 상태가 실제로
  // 바뀔 때만 새 프레임을 보낸다. 종료 상태(완료·실패·취소)에 닿으면 그 프레임을 보내고 스트림을
  // 닫는다 — 클라이언트는 그 뒤로 재연결하지 않는다.
  http.get('*/api/executions/:executionId/stream', ({ params }) => {
    const executionId = String(params.executionId);
    const execution = executions.get(executionId);
    if (!execution) return new HttpResponse(null, { status: 404 });

    const encoder = new TextEncoder();
    let lastStatus: ExecutionStatus | null = null;
    let intervalId: ReturnType<typeof setInterval>;

    const stream = new ReadableStream({
      start(controller) {
        const push = () => {
          const current = executions.get(executionId);
          if (!current) {
            clearInterval(intervalId);
            controller.close();
            return;
          }
          const status = statusOf(current);
          if (status === lastStatus) return;
          lastStatus = status;
          const frame = `data: ${JSON.stringify(stateOf(executionId, current))}\n\n`;
          controller.enqueue(encoder.encode(frame));
          if (isTerminalStatus(status)) {
            clearInterval(intervalId);
            controller.close();
          }
        };
        // interval 을 먼저 등록해야 push() 의 최초 호출에서 바로 terminal 을 만나도
        // (이미 완료된 실행에 뒤늦게 연결하는 경우 등) intervalId 가 정의돼 있어 제대로
        // 정리된다 — 반대 순서면 초기 push 의 clearInterval 이 undefined 를 지워 아무
        // 효과가 없고, 그 직후 등록된 interval 은 영원히 남는다.
        intervalId = setInterval(push, STREAM_CHECK_MS);
        push();
      },
      cancel() {
        clearInterval(intervalId);
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),
];

/** 테스트용 — mock 실행 저장소 초기화 */
export function __resetExecutionMocks() {
  executions.clear();
}
