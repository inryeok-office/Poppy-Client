import { api, sessionAuthHeaders, type ApiResponse } from '@/shared/api';

import type {
  ExecutionState,
  ExecutionStatusResponseDto,
  RequestExecutionRequest,
  RequestExecutionResult,
  ServerExecutionStatus,
} from '../model/types';
import { mapExecutionStatus } from '../model/types';

function mapState(data: ExecutionStatusResponseDto): ExecutionState {
  return {
    ...data,
    status: mapExecutionStatus(data.status),
    missionCleared: data.status === 'COMPLETED' ? true : null,
    elapsedSec:
      data.startedAt && data.finishedAt
        ? Math.max(0, (Date.parse(data.finishedAt) - Date.parse(data.startedAt)) / 1000)
        : null,
    // The Server status DTO has no user-facing message. Keep presentation copy
    // in RunReadyWorkspace instead of fabricating transport data here.
    message: null,
  };
}

export function mapSseState(
  data: Omit<ExecutionStatusResponseDto, 'sessionId' | 'blockVersion' | 'queuedAt'>,
): ExecutionState {
  return mapState({ ...data, sessionId: null, blockVersion: null, queuedAt: null });
}

export async function requestExecution(
  request: RequestExecutionRequest,
): Promise<RequestExecutionResult> {
  const response = await api.post<
    ApiResponse<{
      executionId: string;
      sessionId: string;
      blockVersion: number;
      status: ServerExecutionStatus;
      queuedAt: string;
    }>
  >(
    `/api/v1/sessions/${request.sessionId}/executions`,
    { blockVersion: request.blockVersion },
    { headers: sessionAuthHeaders(request.sessionId) },
  );
  return { ...response.data.data, status: mapExecutionStatus(response.data.data.status) };
}

export async function getExecutionState(
  sessionId: string,
  executionId: string,
): Promise<ExecutionState> {
  const response = await api.get<ApiResponse<ExecutionStatusResponseDto>>(
    `/api/v1/executions/${executionId}`,
    { headers: sessionAuthHeaders(sessionId) },
  );
  return mapState(response.data.data);
}

export async function cancelExecution(
  sessionId: string,
  executionId: string,
): Promise<ExecutionState> {
  const response = await api.post<
    ApiResponse<{ executionId: string; status: ServerExecutionStatus }>
  >(`/api/v1/executions/${executionId}/cancel`, undefined, {
    headers: sessionAuthHeaders(sessionId),
  });
  return {
    executionId: response.data.data.executionId,
    status: mapExecutionStatus(response.data.data.status),
    missionCleared: null,
    elapsedSec: null,
    message: null,
  };
}
