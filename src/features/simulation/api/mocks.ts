import { HttpResponse, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import { getMockSession } from '@/features/session/api/mocks';

/** 6×6 박람회 — Server 에 설정이 없을 때 돌려주는 값과 같다. */
export const MOCK_ARENA_SETTINGS = {
  presetCode: '6x6-박람회',
  widthM: 6,
  depthM: 6,
  marginM: 0.4,
  startXM: 5.6,
  startYM: 0.4,
  startHeading: '+Y',
  limits: { usableWidthM: 5.2, usableDepthM: 5.2, maxMovePerCommandM: 3, defaultMoveDistanceM: 1 },
  updatedAt: null,
};

export const simulationHandlers = [
  http.get('*/api/v1/arena-settings', () =>
    HttpResponse.json<ApiResponse<typeof MOCK_ARENA_SETTINGS>>({
      success: true,
      data: MOCK_ARENA_SETTINGS,
      error: null,
    }),
  ),
  http.post('*/api/v1/sessions/:sessionId/simulation-passes', async ({ params, request }) => {
    const sessionId = String(params.sessionId);
    const session = getMockSession(sessionId);
    if (!session || request.headers.get('X-Session-Token') !== session.sessionToken) {
      return new HttpResponse(null, { status: 401 });
    }
    const { blockVersion } = (await request.json()) as { blockVersion?: number };
    if (blockVersion !== session.currentBlockVersion || blockVersion <= 0) {
      return new HttpResponse(null, { status: 409 });
    }
    const created = !session.passedVersions.has(blockVersion);
    session.passedVersions.add(blockVersion);
    return HttpResponse.json<
      ApiResponse<{
        sessionId: string;
        blockVersion: number;
        passedAt: string;
      }>
    >(
      {
        success: true,
        data: { sessionId, blockVersion, passedAt: new Date().toISOString() },
        error: null,
      },
      { status: created ? 201 : 200 },
    );
  }),
];
