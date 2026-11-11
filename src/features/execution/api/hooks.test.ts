import { describe, expect, it } from 'vitest';

import { EXECUTION_POLL_MS, executionPollInterval } from './hooks';
import type { ExecutionState } from '../model/types';

const state = (status: ExecutionState['status']) => ({ status }) as ExecutionState;

describe('executionPollInterval', () => {
  it('끝나지 않은 실행은 SSE 와 별개로 다시 조회한다', () => {
    expect(executionPollInterval(undefined)).toBe(EXECUTION_POLL_MS);
    expect(executionPollInterval(state('queued'))).toBe(EXECUTION_POLL_MS);
    expect(executionPollInterval(state('assigned'))).toBe(EXECUTION_POLL_MS);
    expect(executionPollInterval(state('running'))).toBe(EXECUTION_POLL_MS);
  });

  it('끝난 실행은 다시 조회하지 않는다', () => {
    expect(executionPollInterval(state('completed'))).toBe(false);
    expect(executionPollInterval(state('failed'))).toBe(false);
    expect(executionPollInterval(state('cancelled'))).toBe(false);
  });
});
