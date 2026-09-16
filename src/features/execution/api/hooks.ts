import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { subscribeExecutionState } from '../lib/executionStream';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';

export function useRequestExecution() {
  return useMutation({ mutationFn: requestExecution });
}

export function useCancelExecution() {
  return useMutation({ mutationFn: cancelExecution });
}

/**
 * 실행 상태 구독 (명세: "Server → Web 실시간 갱신은 SSE를 사용한다"). 처음엔 REST로 한 번
 * 조회하고, 이후 갱신은 SSE 구독이 밀어준다 — 재연결·화면 복구는 subscribeExecutionState 가
 * 처리한다.
 */
export function useExecutionState(executionId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => getExecutionState(executionId as string),
    enabled: executionId !== null,
  });

  useEffect(() => {
    if (executionId === null) return;
    return subscribeExecutionState(executionId, (state) => {
      queryClient.setQueryData(['execution', executionId], state);
    });
  }, [executionId, queryClient]);

  return query;
}
