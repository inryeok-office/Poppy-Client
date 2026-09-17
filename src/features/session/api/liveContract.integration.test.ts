import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import axios from 'axios';

import { getExecutionState, requestExecution } from '@/features/execution';
import { recordSimulationPass } from '@/features/simulation';
import { api, clearSessionCredentials, writeSessionCredentials } from '@/shared/api';
import { server } from '@/shared/api/msw/server';

import { createSession, restoreSession, saveProject } from './sessionApi';

const liveServerUrl = process.env.POPPY_CROSS_REPO_SERVER_URL;

const SERVER_COMPATIBLE_PROGRAM = {
  chain: [
    { id: 'start-live', kind: 'start' as const },
    { id: 'wait-live', kind: 'wait' as const, seconds: 1 },
    { id: 'end-live', kind: 'end' as const },
  ],
  detached: [],
};

describe.skipIf(!liveServerUrl)('Poppy-Server live contract smoke', () => {
  const originalBaseUrl = api.defaults.baseURL;

  beforeAll(() => {
    // The normal Vitest setup installs MSW with fail-fast handling for unknown
    // requests. This opt-in suite deliberately bypasses it for the real local
    // Server process.
    server.close();
    api.defaults.baseURL = liveServerUrl;
    // Vitest runs in jsdom, so Axios would otherwise select the browser XHR
    // adapter and require CORS headers from the local test Server.
    api.defaults.adapter = axios.getAdapter('http');
  });

  afterAll(() => {
    api.defaults.baseURL = originalBaseUrl;
    clearSessionCredentials();
  });

  it('uses the real session, immutable revision, pass, execution, status, and restore contracts', async () => {
    const created = await createSession();
    expect(created.sessionId).toEqual(expect.any(String));
    expect(created.sessionToken).toEqual(expect.any(String));
    expect(created.recoveryCode).toEqual(expect.any(String));
    expect(created.currentBlockVersion).toBe(0);

    const revision = await saveProject(created.sessionId, {
      program: SERVER_COMPATIBLE_PROGRAM,
      baseVersion: created.currentBlockVersion,
    });
    expect(revision.sessionId).toBe(created.sessionId);
    expect(revision.blockVersion).toBeGreaterThan(0);

    const pass = await recordSimulationPass(created.sessionId, revision.blockVersion);
    expect(pass.sessionId).toBe(created.sessionId);
    expect(pass.blockVersion).toBe(revision.blockVersion);

    const nextRevision = await saveProject(created.sessionId, {
      program: SERVER_COMPATIBLE_PROGRAM,
      baseVersion: revision.blockVersion,
    });
    await expect(
      requestExecution({ sessionId: created.sessionId, blockVersion: revision.blockVersion }),
    ).rejects.toMatchObject({ status: 409 });
    const nextPass = await recordSimulationPass(created.sessionId, nextRevision.blockVersion);
    expect(nextPass.blockVersion).toBe(nextRevision.blockVersion);

    const requested = await requestExecution({
      sessionId: created.sessionId,
      blockVersion: nextRevision.blockVersion,
    });
    expect(requested.executionId).toEqual(expect.any(String));
    expect(requested.sessionId).toBe(created.sessionId);
    expect(requested.blockVersion).toBe(nextRevision.blockVersion);
    expect(['queued', 'assigned', 'running', 'completed']).toContain(requested.status);

    const current = await getExecutionState(created.sessionId, requested.executionId);
    expect(current.executionId).toBe(requested.executionId);
    expect(current.blockVersion).toBe(nextRevision.blockVersion);
    expect(['queued', 'assigned', 'running', 'completed']).toContain(current.status);

    const restored = await restoreSession(created.recoveryCode);
    expect(restored.sessionId).toBe(created.sessionId);
    expect(restored.sessionToken === created.sessionToken).toBe(false);
    expect(restored.currentBlockVersion).toBe(nextRevision.blockVersion);

    // Keep the credential store explicit for the next request; this assertion
    // also protects the API layer from silently retaining the pre-restore token.
    writeSessionCredentials(restored);
    const afterRestore = await getExecutionState(created.sessionId, requested.executionId);
    expect(afterRestore.executionId).toBe(requested.executionId);

    const staleTokenResponse = await fetch(
      `${liveServerUrl}/api/v1/executions/${requested.executionId}`,
      { headers: { 'X-Session-Token': created.sessionToken } },
    );
    expect(staleTokenResponse.status).toBe(401);

    const sseResponse = await fetch(
      `${liveServerUrl}/api/v1/sessions/${created.sessionId}/events`,
      {
        headers: { 'X-Session-Token': restored.sessionToken },
      },
    );
    expect(sseResponse.status).toBe(200);
    expect(sseResponse.headers.get('content-type')).toContain('text/event-stream');
    const reader = sseResponse.body?.getReader();
    expect(reader).toBeDefined();
    const firstFrame = await reader!.read();
    await reader!.cancel();
    const frame = new TextDecoder().decode(firstFrame.value);
    expect(frame).toMatch(/event:\s*execution-status/);
    expect(frame).toContain(requested.executionId);
  });
});
