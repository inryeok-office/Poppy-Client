import { useMutation, useQuery } from '@tanstack/react-query';

import { isTerminalStatus } from '../model/types';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';

const POLL_INTERVAL_MS = 600;

export function useRequestExecution() {
  return useMutation({ mutationFn: requestExecution });
}

export function useCancelExecution() {
  return useMutation({ mutationFn: cancelExecution });
}

/**
 * 실행 상태 폴링. 종료 상태(완료·실패·취소)가 되면 폴링을 멈춘다.
 * (명세: SSE 우선 검토, 지금은 폴링 — "재연결 시 현재 상태를 다시 조회" 를 만족)
 */
export function useExecutionState(executionId: string | null) {
  return useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => getExecutionState(executionId as string),
    enabled: executionId !== null,
    refetchInterval: (query) =>
      isTerminalStatus(query.state.data?.status) ? false : POLL_INTERVAL_MS,
  });
}
