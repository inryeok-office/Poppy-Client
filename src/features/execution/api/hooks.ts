import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { subscribeExecutionState } from '../lib/executionStream';
import { cancelExecution, getExecutionState, requestExecution } from './executionApi';
import { isTerminalStatus } from '../model/types';

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
    // SSE is the normal low-latency path.  A very short mock (or a fast real
    // transition) can finish after the initial REST read but before the stream
    // subscription is established; the Server then has no active state to send
    // on subscribe.  Poll only while non-terminal so that this race cannot pin
    // the user-visible status at ASSIGNED/RUNNING forever.
    refetchInterval: (query) =>
      isTerminalStatus(query.state.data?.status) ? false : 1_000,
  });

  useEffect(() => {
    if (sessionId === null || executionId === null) return;
    return subscribeExecutionState(sessionId, executionId, (state) => {
      queryClient.setQueryData(['execution', sessionId, executionId], state);
    });
  }, [executionId, queryClient, sessionId]);

  return query;
}
