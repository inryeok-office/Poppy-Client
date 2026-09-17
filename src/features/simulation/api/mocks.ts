import { HttpResponse, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import { getMockSession } from '@/features/session/api/mocks';

export const simulationHandlers = [
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
