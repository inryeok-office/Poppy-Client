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

export type SessionStatusResponse = {
  sessionId: string;
  blockVersion: number;
  status: 'ACTIVE' | 'EXPIRED';
};

/** 저장된 세션이 Server 에 아직 살아 있는지 확인한다 (GET /api/v1/sessions/{id}). */
export async function getSession(sessionId: string): Promise<SessionStatusResponse> {
  const response = await api.get<ApiResponse<SessionStatusResponse>>(
    `/api/v1/sessions/${sessionId}`,
    { headers: sessionAuthHeaders(sessionId) },
  );
  return response.data.data;
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

/** 서버 블록 계약으로 바꿀 수 없는 프로그램(연결 안 된 블록·지원 안 하는 블록) — 요청 전 거부. */
export class InvalidProgramError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidProgramError';
  }
}

export async function saveProject(
  sessionId: string,
  request: SaveProjectRequest,
): Promise<SaveProjectResult> {
  let document: ReturnType<typeof toServerBlockProgram>;
  try {
    document = toServerBlockProgram(request.program);
  } catch (error) {
    throw new InvalidProgramError(error instanceof Error ? error.message : 'invalid program');
  }
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
