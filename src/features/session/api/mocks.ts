import { HttpResponse, delay, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

type MockSession = {
  sessionToken: string;
  recoveryCode: string;
  currentBlockVersion: number;
  passedVersions: Set<number>;
};

const sessions = new Map<string, MockSession>();

export function getMockSession(sessionId: string): MockSession | undefined {
  return sessions.get(sessionId);
}

function authorized(sessionId: string, request: Request): MockSession | Response {
  const session = sessions.get(sessionId);
  if (!session || request.headers.get('X-Session-Token') !== session.sessionToken) {
    return HttpResponse.json<ApiResponse<never>>(
      {
        success: false,
        data: null as never,
        error: { code: 'SESSION_TOKEN_INVALID', message: 'invalid session token', fieldErrors: [] },
      },
      { status: 401 },
    );
  }
  return session;
}

export const sessionHandlers = [
  http.post('*/api/v1/sessions', async () => {
    await delay(20);
    const sessionId = crypto.randomUUID();
    const session = {
      sessionToken: `session-${crypto.randomUUID()}`,
      recoveryCode: `recovery-${crypto.randomUUID()}`,
      currentBlockVersion: 0,
      passedVersions: new Set<number>(),
    } satisfies MockSession;
    sessions.set(sessionId, session);
    return HttpResponse.json<
      ApiResponse<{
        sessionId: string;
        sessionToken: string;
        currentBlockVersion: number;
        recoveryCode: string;
      }>
    >(
      {
        success: true,
        data: {
          sessionId,
          sessionToken: session.sessionToken,
          currentBlockVersion: session.currentBlockVersion,
          recoveryCode: session.recoveryCode,
        },
        error: null,
      },
      { status: 201 },
    );
  }),

  http.post('*/api/v1/sessions/restore', async ({ request }) => {
    const { recoveryCode } = (await request.json()) as { recoveryCode?: string };
    const entry = [...sessions.entries()].find(([, value]) => value.recoveryCode === recoveryCode);
    if (!entry) return new HttpResponse(null, { status: 401 });
    const [sessionId, session] = entry;
    session.sessionToken = `session-${crypto.randomUUID()}`;
    session.recoveryCode = `recovery-${crypto.randomUUID()}`;
    return HttpResponse.json<
      ApiResponse<{
        sessionId: string;
        sessionToken: string;
        currentBlockVersion: number;
        recoveryCode: string;
      }>
    >({
      success: true,
      data: {
        sessionId,
        sessionToken: session.sessionToken,
        currentBlockVersion: session.currentBlockVersion,
        recoveryCode: session.recoveryCode,
      },
      error: null,
    });
  }),

  http.post('*/api/v1/sessions/:sessionId/block-revisions', async ({ params, request }) => {
    const sessionId = String(params.sessionId);
    const session = authorized(sessionId, request);
    if (session instanceof Response) return session;
    const body = (await request.json()) as { document?: unknown };
    if (!body.document) return new HttpResponse(null, { status: 400 });
    session.currentBlockVersion += 1;
    session.passedVersions.clear();
    return HttpResponse.json<ApiResponse<{ sessionId: string; blockVersion: number }>>(
      {
        success: true,
        data: { sessionId, blockVersion: session.currentBlockVersion },
        error: null,
      },
      { status: 201 },
    );
  }),
];

export function __resetSessionMocks() {
  sessions.clear();
}
