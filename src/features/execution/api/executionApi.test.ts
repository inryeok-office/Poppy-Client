import { afterEach, describe, expect, it } from 'vitest';

import { recordSimulationPass } from '@/features/simulation';
import { clearSessionCredentials } from '@/shared/api';
import { createSession, saveProject } from '@/features/session';

import { __resetExecutionMocks } from './mocks';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';
import { __resetSessionMocks } from '@/features/session/api/mocks';

const runnableProgram = {
  chain: [
    { id: 'start-0', kind: 'start' as const },
    { id: 'wait-0', kind: 'wait' as const, seconds: 1 },
    { id: 'end-0', kind: 'end' as const },
  ],
  detached: [],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function readyExecutionRequest() {
  const session = await createSession();
  const revision = await saveProject(session.sessionId, {
    program: runnableProgram,
    baseVersion: 0,
  });
  await recordSimulationPass(session.sessionId, revision.blockVersion);
  return { session, blockVersion: revision.blockVersion };
}

afterEach(() => {
  clearSessionCredentials();
  __resetSessionMocks();
  __resetExecutionMocks();
});

describe('execution API aligned with Poppy-Server', () => {
  it('requests and reads an immutable block-version execution', async () => {
    const { session, blockVersion } = await readyExecutionRequest();
    const requested = await requestExecution({ sessionId: session.sessionId, blockVersion });

    expect(requested.executionId).toBeTruthy();
    expect(requested.status).toBe('queued');
    expect((await getExecutionState(session.sessionId, requested.executionId)).status).toBe(
      'queued',
    );

    await wait(2600);
    const done = await getExecutionState(session.sessionId, requested.executionId);
    expect(done.status).toBe('completed');
    expect(done.missionCleared).toBe(true);
  });

  it('rejects an execution request without the current Simulation Pass', async () => {
    const session = await createSession();
    const revision = await saveProject(session.sessionId, {
      program: runnableProgram,
      baseVersion: 0,
    });

    await expect(
      requestExecution({ sessionId: session.sessionId, blockVersion: revision.blockVersion }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 409,
    });
  });

  it('cancels QUEUED work but preserves RUNNING cancellation policy', async () => {
    const { session, blockVersion } = await readyExecutionRequest();
    const queued = await requestExecution({ sessionId: session.sessionId, blockVersion });
    expect((await cancelExecution(session.sessionId, queued.executionId)).status).toBe('cancelled');

    const nextRevision = await saveProject(session.sessionId, {
      program: runnableProgram,
      baseVersion: blockVersion,
    });
    await recordSimulationPass(session.sessionId, nextRevision.blockVersion);
    const running = await requestExecution({
      sessionId: session.sessionId,
      blockVersion: nextRevision.blockVersion,
    });
    await wait(1300);
    expect((await getExecutionState(session.sessionId, running.executionId)).status).toBe(
      'running',
    );
    expect((await cancelExecution(session.sessionId, running.executionId)).status).toBe('running');
  });
});
