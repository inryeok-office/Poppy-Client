import { api, sessionAuthHeaders, writeSessionCredentials, type ApiResponse } from '@/shared/api';
import { toServerBlockProgram, type SerializedBlockProgram } from '@/features/simulation';

import type {
  SaveProjectRequest,
  SaveProjectResult,
  SessionInfo,
  SessionRecoveryResult,
} from '../model/types';

type ServerSessionResponse = {
  sessionId: string;
  sessionToken: string;
  currentBlockVersion: number;
  recoveryCode: string;
};

function mapSession(data: ServerSessionResponse): SessionInfo {
  const session = { ...data, projectVersion: data.currentBlockVersion };
  writeSessionCredentials(session);
  return session;
}

export async function createSession(): Promise<SessionInfo> {
  const response = await api.post<ApiResponse<ServerSessionResponse>>('/api/v1/sessions');
  return mapSession(response.data.data);
}

export async function restoreSession(recoveryCode: string): Promise<SessionRecoveryResult> {
  const response = await api.post<ApiResponse<ServerSessionResponse>>('/api/v1/sessions/restore', {
    recoveryCode,
  });
  return mapSession(response.data.data);
}

export async function saveProject(
  sessionId: string,
  request: SaveProjectRequest,
): Promise<SaveProjectResult> {
  const document = toServerBlockProgram(request.program);
  const response = await api.post<ApiResponse<{ sessionId: string; blockVersion: number }>>(
    `/api/v1/sessions/${sessionId}/block-revisions`,
    { document },
    { headers: sessionAuthHeaders(sessionId) },
  );
  return {
    ...response.data.data,
    projectVersion: response.data.data.blockVersion,
  };
}

export function serverDocumentFromProgram(program: SerializedBlockProgram) {
  return toServerBlockProgram(program);
}
