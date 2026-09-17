import { HttpResponse, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import { getMockSession } from '@/features/session/api/mocks';

import type { ServerExecutionStatus } from '../model/types';

const TIMELINE_MS = { assigned: 500, running: 1100, completed: 2400 } as const;

type MockExecution = {
  sessionId: string;
  blockVersion: number;
  requestedAt: number;
  cancelledAt: number | null;
};

const executions = new Map<string, MockExecution>();

function statusOf(execution: MockExecution): ServerExecutionStatus {
  if (execution.cancelledAt !== null) return 'CANCELLED';
  const elapsed = Date.now() - execution.requestedAt;
  if (elapsed < TIMELINE_MS.assigned) return 'QUEUED';
  if (elapsed < TIMELINE_MS.running) return 'ASSIGNED';
  if (elapsed < TIMELINE_MS.completed) return 'RUNNING';
  return 'COMPLETED';
}

function stateOf(executionId: string, execution: MockExecution) {
  const status = statusOf(execution);
  return {
    executionId,
    sessionId: execution.sessionId,
    blockVersion: execution.blockVersion,
    status,
    queuePosition: status === 'QUEUED' ? 1 : null,
    assignedRobotId: null,
    queuedAt: new Date(execution.requestedAt).toISOString(),
    startedAt:
      status === 'RUNNING' || status === 'COMPLETED'
        ? new Date(execution.requestedAt + TIMELINE_MS.running).toISOString()
        : null,
    finishedAt: status === 'COMPLETED' || status === 'CANCELLED' ? new Date().toISOString() : null,
  };
}

function authorized(sessionId: string, request: Request): Response | true {
  const session = getMockSession(sessionId);
  return session && request.headers.get('X-Session-Token') === session.sessionToken
    ? true
    : new HttpResponse(null, { status: 401 });
}

export const executionHandlers = [
  http.post('*/api/v1/sessions/:sessionId/executions', async ({ params, request }) => {
    const sessionId = String(params.sessionId);
    const auth = authorized(sessionId, request);
    if (auth !== true) return auth;
    const { blockVersion } = (await request.json()) as { blockVersion?: number };
    const session = getMockSession(sessionId);
    if (
      !session ||
      blockVersion !== session.currentBlockVersion ||
      !session.passedVersions.has(blockVersion)
    ) {
      return new HttpResponse(null, { status: 409 });
    }
    const executionId = crypto.randomUUID();
    executions.set(executionId, {
      sessionId,
      blockVersion,
      requestedAt: Date.now(),
      cancelledAt: null,
    });
    return HttpResponse.json<ApiResponse<ReturnType<typeof stateOf>>>(
      {
        success: true,
        data: stateOf(executionId, executions.get(executionId)!),
        error: null,
      },
      { status: 201 },
    );
  }),

  http.get('*/api/v1/executions/:executionId', ({ params, request }) => {
    const executionId = String(params.executionId);
    const execution = executions.get(executionId);
    if (!execution || authorized(execution.sessionId, request) !== true)
      return new HttpResponse(null, { status: 404 });
    return HttpResponse.json<ApiResponse<ReturnType<typeof stateOf>>>({
      success: true,
      data: stateOf(executionId, execution),
      error: null,
    });
  }),

  http.post('*/api/v1/executions/:executionId/cancel', ({ params, request }) => {
    const executionId = String(params.executionId);
    const execution = executions.get(executionId);
    if (!execution || authorized(execution.sessionId, request) !== true)
      return new HttpResponse(null, { status: 404 });
    const status = statusOf(execution);
    if (status === 'QUEUED' || status === 'ASSIGNED') execution.cancelledAt = Date.now();
    return HttpResponse.json<ApiResponse<{ executionId: string; status: ServerExecutionStatus }>>({
      success: true,
      data: { executionId, status: statusOf(execution) },
      error: null,
    });
  }),

  http.get('*/api/v1/sessions/:sessionId/events', ({ params, request }) => {
    const sessionId = String(params.sessionId);
    const auth = authorized(sessionId, request);
    if (auth !== true) return auth;
    const encoder = new TextEncoder();
    let lastStatus: ServerExecutionStatus | null = null;
    let intervalId: ReturnType<typeof setInterval>;
    const stream = new ReadableStream({
      start(controller) {
        const push = () => {
          const entries = [...executions.entries()].filter(
            ([, value]) => value.sessionId === sessionId,
          );
          const latest = entries.at(-1);
          if (!latest) return;
          const [executionId, execution] = latest;
          const status = statusOf(execution);
          if (status === lastStatus) return;
          lastStatus = status;
          controller.enqueue(
            encoder.encode(
              `event: execution-status\ndata: ${JSON.stringify(stateOf(executionId, execution))}\n\n`,
            ),
          );
          if (status === 'COMPLETED' || status === 'CANCELLED') {
            clearInterval(intervalId);
            controller.close();
          }
        };
        intervalId = setInterval(push, 100);
        push();
      },
      cancel() {
        clearInterval(intervalId);
      },
    });
    return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
  }),
];

export function __resetExecutionMocks() {
  executions.clear();
}
