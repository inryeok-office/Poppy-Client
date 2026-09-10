import { api, type ApiResponse } from '@/shared/api';

import type { SaveProjectRequest, SaveProjectResult, SessionInfo } from '../model/types';

/** 로그인 없이 체험자별 임시 세션을 만든다 (명세 Session "체험 세션 생성"). */
export async function createSession(): Promise<SessionInfo> {
  const response = await api.post<ApiResponse<SessionInfo>>('/api/sessions', {});
  return response.data.data;
}

/** 현재 프로젝트를 서버에 저장한다 (명세 Session "프로젝트 자동 저장"). */
export async function saveProject(
  sessionId: string,
  request: SaveProjectRequest,
): Promise<SaveProjectResult> {
  const response = await api.put<ApiResponse<SaveProjectResult>>(
    `/api/sessions/${sessionId}/project`,
    request,
  );
  return response.data.data;
}
