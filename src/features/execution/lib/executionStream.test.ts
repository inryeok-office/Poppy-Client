import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { recordSimulationPass } from '@/features/simulation';
import { createSession, saveProject } from '@/features/session';
import { clearSessionCredentials, sessionAuthHeaders } from '@/shared/api';
import { server } from '@/shared/api/msw/server';

import { __resetExecutionMocks } from '../api/mocks';
import { requestExecution } from '../api/executionApi';
import { __resetSessionMocks } from '@/features/session/api/mocks';
import type { ExecutionSseEventDto, ExecutionState } from '../model/types';
import { subscribeExecutionState } from './executionStream';

const runnableProgram = {
  chain: [
    { id: 'start-0', kind: 'start' as const },
    { id: 'wait-0', kind: 'wait' as const, seconds: 1 },
    { id: 'end-0', kind: 'end' as const },
  ],
  detached: [],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function setup() {
  const session = await createSession();
  const revision = await saveProject(session.sessionId, {
    program: runnableProgram,
    baseVersion: 0,
  });
  await recordSimulationPass(session.sessionId, revision.blockVersion);
  const execution = await requestExecution({
    sessionId: session.sessionId,
    blockVersion: revision.blockVersion,
  });
  return { session, execution };
}

afterEach(() => {
  clearSessionCredentials();
  __resetSessionMocks();
  __resetExecutionMocks();
});

describe('session-scoped authenticated execution SSE', () => {
  it('receives the current state and terminal status', async () => {
    const { session, execution } = await setup();
    const received: ExecutionState[] = [];
    const unsubscribe = subscribeExecutionState(session.sessionId, execution.executionId, (state) =>
      received.push(state),
    );

    await wait(150);
    unsubscribe();
    expect(received[0]?.status).toBe('queued');
  });

  it('filters session events by executionId and stops after terminal state', async () => {
    const { session, execution } = await setup();
    const statuses: string[] = [];
    const unsubscribe = subscribeExecutionState(session.sessionId, execution.executionId, (state) =>
      statuses.push(state.status),
    );

    await wait(2700);
    unsubscribe();
    expect(statuses).toEqual(['queued', 'assigned', 'running', 'completed']);
  });

  it('sends X-Session-Token and does not reconnect a rejected stream', async () => {
    const { session, execution } = await setup();
    let attempts = 0;
    server.use(
      http.get('*/api/v1/sessions/:sessionId/events', ({ request }) => {
        attempts += 1;
        expect(request.headers.get('X-Session-Token')).toBe(session.sessionToken);
        return new HttpResponse(null, { status: 401 });
      }),
    );
    const unsubscribe = subscribeExecutionState(session.sessionId, execution.executionId, () => {});
    await wait(700);
    unsubscribe();
    expect(attempts).toBe(1);
  });

  it('parses event names, fragmented data, and CRLF frames', async () => {
    const { session, execution } = await setup();
    const received: string[] = [];
    const event: ExecutionSseEventDto = {
      executionId: execution.executionId,
      status: 'RUNNING',
      queuePosition: null,
      assignedRobotId: null,
      startedAt: null,
      finishedAt: null,
    };
    server.use(
      http.get('*/api/v1/sessions/:sessionId/events', () => {
        const encoded = new TextEncoder().encode(
          `event: execution-status\r\ndata: ${JSON.stringify(event)}\r\n\r\n`,
        );
        return new HttpResponse(
          new ReadableStream({
            start(controller) {
              controller.enqueue(encoded.slice(0, 20));
              controller.enqueue(encoded.slice(20));
              controller.close();
            },
          }),
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      }),
    );
    const unsubscribe = subscribeExecutionState(session.sessionId, execution.executionId, (state) =>
      received.push(state.status),
    );
    await wait(150);
    unsubscribe();
    expect(received).toEqual(['running']);
    expect(sessionAuthHeaders(session.sessionId)['X-Session-Token']).toBe(session.sessionToken);
  });
});
