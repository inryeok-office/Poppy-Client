import { afterEach, describe, expect, it } from 'vitest';

import type { SerializedBlockProgram } from '@/features/simulation';

import { __resetSessionMocks } from './mocks';
import { createSession, saveProject } from './sessionApi';

const demoProgram: SerializedBlockProgram = {
  chain: [
    { id: 'start-0', kind: 'start' },
    {
      id: 'repeat-0',
      kind: 'repeat',
      count: 2,
      body: [{ id: 'move-0', kind: 'move', distanceM: 1 }],
    },
    { id: 'greet-0', kind: 'greet' },
    { id: 'end-0', kind: 'end' },
  ],
  detached: [],
};

afterEach(() => __resetSessionMocks());

describe('session mock API', () => {
  it('세션을 만들고, 저장할수록 버전이 올라간다', async () => {
    const { sessionId, projectVersion } = await createSession();
    expect(sessionId).toBeTruthy();
    expect(projectVersion).toBe(0);

    expect(
      (await saveProject(sessionId, { program: demoProgram, baseVersion: 0 })).projectVersion,
    ).toBe(1);
    expect(
      (await saveProject(sessionId, { program: demoProgram, baseVersion: 1 })).projectVersion,
    ).toBe(2);
  });

  it('오래된 baseVersion 으로 저장하면 409 (버전 충돌)', async () => {
    const { sessionId } = await createSession();
    await saveProject(sessionId, { program: demoProgram, baseVersion: 0 });

    await expect(
      saveProject(sessionId, { program: demoProgram, baseVersion: 0 }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 409 });
  });
});
