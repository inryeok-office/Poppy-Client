import { HttpResponse, delay, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import type { SaveProjectRequest, SaveProjectResult, SessionInfo } from '../model/types';

// 백엔드(Poppy-Server) 전 임시 mock. 세션별 프로젝트 버전을 메모리에 들고 있다.
const versions = new Map<string, number>();

export const sessionHandlers = [
  http.post('*/api/sessions', async () => {
    await delay(150);
    const sessionId = crypto.randomUUID();
    versions.set(sessionId, 0);
    return HttpResponse.json<ApiResponse<SessionInfo>>({
      success: true,
      data: { sessionId, projectVersion: 0 },
    });
  }),

  http.put('*/api/sessions/:sessionId/project', async ({ params, request }) => {
    const sessionId = String(params.sessionId);
    const { baseVersion } = (await request.json()) as SaveProjectRequest;
    await delay(250);

    const current = versions.get(sessionId) ?? 0;
    // 버전 충돌 감지 (명세: "버전 번호로 최신 수정 충돌을 감지")
    if (baseVersion < current) {
      return HttpResponse.json<ApiResponse<never>>({ success: false } as ApiResponse<never>, {
        status: 409,
      });
    }

    const projectVersion = current + 1;
    versions.set(sessionId, projectVersion);
    return HttpResponse.json<ApiResponse<SaveProjectResult>>({
      success: true,
      data: { projectVersion },
    });
  }),
];

/** 테스트용 — mock 세션 버전 저장소 초기화 */
export function __resetSessionMocks() {
  versions.clear();
}
