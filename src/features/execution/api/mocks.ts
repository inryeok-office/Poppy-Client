import { HttpResponse, delay, http } from 'msw';

import { evaluateProgram, type SerializedBlockProgram } from '@/features/simulation';
import type { ApiResponse } from '@/shared/api';

import type { ExecutionState, ExecutionStatus, RequestExecutionRequest } from '../model/types';

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
    if (
      statusOf(execution) === 'running' ||
      statusOf(execution) === 'queued' ||
      statusOf(execution) === 'assigned'
    ) {
      execution.cancelledAt = Date.now();
    }
    return HttpResponse.json<ApiResponse<ExecutionState>>({
      success: true,
      data: stateOf(executionId, execution),
    });
  }),
];

/** 테스트용 — mock 실행 저장소 초기화 */
export function __resetExecutionMocks() {
  executions.clear();
}
