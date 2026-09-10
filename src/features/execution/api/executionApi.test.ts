import { afterEach, describe, expect, it } from 'vitest';

import { __resetExecutionMocks } from './mocks';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';

const runnableProgram = {
  chain: ['start', 'repeat', 'move', 'greet', 'end'],
  detached: [],
  repeatCount: 2,
  moveDistance: 1,
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
    await expect(
      requestExecution({ program: { ...runnableProgram, repeatCount: 10 } }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 422 });
  });

  it('진행 중 취소하면 cancelled 가 된다', async () => {
    const { executionId } = await requestExecution({ program: runnableProgram });
    const cancelled = await cancelExecution(executionId);
    expect(cancelled.status).toBe('cancelled');
    expect((await getExecutionState(executionId)).status).toBe('cancelled');
  });
});
