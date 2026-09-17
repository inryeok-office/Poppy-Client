import { afterEach, describe, expect, it } from 'vitest';

import { clearSessionCredentials, readSessionCredentials } from '@/shared/api';

import { __resetSessionMocks } from './mocks';
import { createSession, restoreSession, saveProject } from './sessionApi';

const demoProgram = {
  chain: [
    { id: 'start-0', kind: 'start' as const },
    { id: 'wait-0', kind: 'wait' as const, seconds: 1 },
    { id: 'end-0', kind: 'end' as const },
  ],
  detached: [],
};

afterEach(() => {
  clearSessionCredentials();
  __resetSessionMocks();
});

describe('session API aligned with Poppy-Server', () => {
  it('creates a session and persists the credential without logging it', async () => {
    const session = await createSession();
    expect(session.sessionId).toBeTruthy();
    expect(session.currentBlockVersion).toBe(0);
    expect(readSessionCredentials()).toMatchObject({ sessionId: session.sessionId });
  });

  it('creates immutable block revisions with the X-Session-Token contract', async () => {
    const session = await createSession();
    const first = await saveProject(session.sessionId, { program: demoProgram, baseVersion: 0 });
    const second = await saveProject(session.sessionId, {
      program: demoProgram,
      baseVersion: first.blockVersion,
    });
    expect(first.blockVersion).toBe(1);
    expect(second.blockVersion).toBe(2);
  });

  it('rotates session credentials through recovery', async () => {
    const session = await createSession();
    const oldToken = session.sessionToken;
    const restored = await restoreSession(session.recoveryCode);
    expect(restored.sessionId).toBe(session.sessionId);
    expect(restored.sessionToken).not.toBe(oldToken);
    expect(restored.currentBlockVersion).toBe(0);
  });

  it('rejects a disconnected block or unsupported Client-only block', async () => {
    const session = await createSession();
    await expect(
      saveProject(session.sessionId, {
        program: {
          chain: [{ id: 'start-0', kind: 'start' }],
          detached: [{ id: 'end-0', kind: 'end' }],
        },
        baseVersion: 0,
      }),
    ).rejects.toThrow('Disconnected blocks');
  });
});
