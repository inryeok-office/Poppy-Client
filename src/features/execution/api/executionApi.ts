import { api, type ApiResponse } from '@/shared/api';

import type {
  ExecutionState,
  RequestExecutionRequest,
  RequestExecutionResult,
} from '../model/types';

/** 통과한 프로그램을 실제 로봇 실행 대기열에 넣는다 (명세 Execution "실제 실행 요청"). */
export async function requestExecution(
  request: RequestExecutionRequest,
): Promise<RequestExecutionResult> {
  const response = await api.post<ApiResponse<RequestExecutionResult>>('/api/executions', request);
  return response.data.data;
}

/** 현재 실행 상태를 조회한다 (명세: "재연결 시 현재 상태를 다시 조회"). */
export async function getExecutionState(executionId: string): Promise<ExecutionState> {
  const response = await api.get<ApiResponse<ExecutionState>>(`/api/executions/${executionId}`);
  return response.data.data;
}

/** 대기·진행 중인 실행을 사용자가 취소한다 (명세 Execution "실행 중지"). */
export async function cancelExecution(executionId: string): Promise<ExecutionState> {
  const response = await api.post<ApiResponse<ExecutionState>>(
    `/api/executions/${executionId}/cancel`,
  );
  return response.data.data;
}
