import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { subscribeExecutionState } from '../lib/executionStream';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';

export function useRequestExecution() {
  return useMutation({ mutationFn: requestExecution });
}

export function useCancelExecution() {
  return useMutation({
    mutationFn: ({ sessionId, executionId }: { sessionId: string; executionId: string }) =>
      cancelExecution(sessionId, executionId),
  });
}

/**
 * 실행 상태 구독 (명세: "Server → Web 실시간 갱신은 SSE를 사용한다"). 처음엔 REST로 한 번
 * 조회하고, 이후 갱신은 SSE 구독이 밀어준다 — 재연결·화면 복구는 subscribeExecutionState 가
 * 처리한다.
 */
export function useExecutionState(sessionId: string | null, executionId: string | null) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['execution', sessionId, executionId],
    queryFn: () => getExecutionState(sessionId as string, executionId as string),
    enabled: sessionId !== null && executionId !== null,
  });

  useEffect(() => {
    if (sessionId === null || executionId === null) return;
    return subscribeExecutionState(sessionId, executionId, (state) => {
      queryClient.setQueryData(['execution', sessionId, executionId], state);
      // SSE 이벤트엔 missionResult 가 없다 — 완료되면 상태 조회로 판정 결과를 다시 읽는다.
      if (state.status === 'completed') {
        void queryClient.invalidateQueries({ queryKey: ['execution', sessionId, executionId] });
      }
    });
  }, [executionId, queryClient, sessionId]);

  return query;
}
