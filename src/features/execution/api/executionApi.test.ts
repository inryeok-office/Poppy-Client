import { afterEach, describe, expect, it } from 'vitest';

import type { SerializedBlockProgram } from '@/features/simulation';

import { __resetExecutionMocks } from './mocks';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';

const runnableProgram: SerializedBlockProgram = {
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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => __resetExecutionMocks());

describe('execution mock API', () => {
  it('통과 가능한 프로그램은 executionId 를 발급하고 대기→진행→완료로 흐른다', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    expect(executionId).toBeTruthy();

    expect((await getExecutionState(executionId)).status).toBe('queued');

    await wait(1300);
    expect(['assigned', 'running']).toContain((await getExecutionState(executionId)).status);

    await wait(1400);
    const done = await getExecutionState(executionId);
    expect(done.status).toBe('completed');
    expect(done.missionCleared).toBe(true);
    expect(done.message).toBeTruthy();
  });

  it('안전하지 않은 프로그램은 실행 요청을 거부한다', async () => {
    const unsafeProgram: SerializedBlockProgram = {
      chain: [
        { id: 'start-0', kind: 'start' },
        // 반복 10회 × 이동 1m = 10m > 2m 안전 구역
        {
          id: 'repeat-0',
          kind: 'repeat',
          count: 10,
          body: [{ id: 'move-0', kind: 'move', distanceM: 1 }],
        },
        { id: 'greet-0', kind: 'greet' },
        { id: 'end-0', kind: 'end' },
      ],
      detached: [],
    };
    await expect(requestExecution({ program: unsafeProgram })).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
    });
  });

  it('진행 중 취소하면 cancelled 가 된다', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    const cancelled = await cancelExecution(executionId);
    expect(cancelled.status).toBe('cancelled');
    expect((await getExecutionState(executionId)).status).toBe('cancelled');
  });
});
