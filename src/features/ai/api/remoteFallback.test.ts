// #67 — remote 모드에서 Server S1(AI_API.md) 응답별로 Client 가 어떻게 동작하는지 실제 HTTP
// 경로(axios → MSW)로 증명한다. Server 가 503·400·5xx·네트워크 오류·잘못된 응답을 주면
// 반드시 로컬 규칙(planner/hint)으로 대신하고, 그 이유를 fallback 에 남긴다.

import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError } from '@/shared/api';
import { server } from '@/shared/api/msw/server';

import { planFromUtterance } from '../model/planner';
import { AI_REQUEST_TIMEOUT_MS, toRemoteHintRequest } from './aiApi';
import { fallbackReasonOf, generateHint, generateProgramDraft } from './hooks';

const DRAFTS = '*/api/v1/ai/program-drafts';
const HINTS = '*/api/v1/ai/hints';

function failure(status: number, code: string) {
  return HttpResponse.json(
    { success: false, data: null, error: { code, message: '테스트 오류', fieldErrors: [] } },
    { status },
  );
}

const UTTERANCE = '네모를 그리면서 걸어 줘';
const localSteps = () => {
  const local = planFromUtterance(UTTERANCE);
  if (!local.ok) throw new Error('planner 가 예시 문장을 못 알아들음');
  return local.draft.steps;
};

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('remote 초안 — Server S1 응답별 동작', () => {
  it('200 + 검증 통과 → remote 결과를 그대로 쓰고, 정리된 utterance 만 보낸다', async () => {
    let body: unknown;
    server.use(
      http.post(DRAFTS, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          success: true,
          data: {
            steps: [{ kind: 'moveForward', distanceM: 2 }, { kind: 'greet' }],
            explanation: '앞으로 2m 가서 인사하는 블록을 만들었어요.',
          },
          error: null,
        });
      }),
    );

    const draft = await generateProgramDraft('앞으로 2미터 가서 인사해');
    expect(body).toEqual({ utterance: '앞으로 2미터 가서 인사해' });
    expect(draft).toEqual({
      steps: [{ kind: 'moveForward', distanceM: 2 }, { kind: 'greet' }],
      explanation: '앞으로 2m 가서 인사하는 블록을 만들었어요.',
      source: 'remote',
    });
  });

  it('503 AI_UNAVAILABLE → 로컬 규칙으로 대신한다(fallback=unavailable)', async () => {
    server.use(http.post(DRAFTS, () => failure(503, 'AI_UNAVAILABLE')));
    const draft = await generateProgramDraft(UTTERANCE);
    expect(draft.source).toBe('local');
    expect(draft.fallback).toBe('unavailable');
    expect(draft.steps).toEqual(localSteps());
  });

  it('500 → 로컬 규칙(unavailable)', async () => {
    server.use(http.post(DRAFTS, () => failure(500, 'INTERNAL')));
    const draft = await generateProgramDraft(UTTERANCE);
    expect(draft).toMatchObject({ source: 'local', fallback: 'unavailable' });
  });

  it('404(아직 S1 이 없는 Server) → 로컬 규칙(unavailable)', async () => {
    server.use(http.post(DRAFTS, () => new HttpResponse(null, { status: 404 })));
    const draft = await generateProgramDraft(UTTERANCE);
    expect(draft).toMatchObject({ source: 'local', fallback: 'unavailable' });
  });

  it('네트워크 오류(Server 응답 없음) → 로컬 규칙(unavailable)', async () => {
    server.use(http.post(DRAFTS, () => HttpResponse.error()));
    const draft = await generateProgramDraft(UTTERANCE);
    expect(draft).toMatchObject({ source: 'local', fallback: 'unavailable' });
  });

  it.each(['AI_INPUT_INVALID', 'AI_INPUT_REJECTED'])(
    '400 %s → 로컬 규칙(rejected)',
    async (code) => {
      server.use(http.post(DRAFTS, () => failure(400, code)));
      const draft = await generateProgramDraft(UTTERANCE);
      expect(draft).toMatchObject({ source: 'local', fallback: 'rejected' });
    },
  );

  it('200 이지만 앉기(sit)·범위 초과 블록 → 받아들이지 않고 로컬 규칙(invalid-response)', async () => {
    server.use(
      http.post(DRAFTS, () =>
        HttpResponse.json({
          success: true,
          data: {
            steps: [{ kind: 'sit' }, { kind: 'moveForward', distanceM: 99 }],
            explanation: 'x',
          },
          error: null,
        }),
      ),
    );
    const draft = await generateProgramDraft(UTTERANCE);
    expect(draft).toMatchObject({ source: 'local', fallback: 'invalid-response' });
    expect(JSON.stringify(draft.steps)).not.toContain('sit');
  });

  it('200 이지만 explanation 이 비어 있으면 로컬 규칙(invalid-response)', async () => {
    server.use(
      http.post(DRAFTS, () =>
        HttpResponse.json({
          success: true,
          data: { steps: [{ kind: 'greet' }], explanation: '  ' },
          error: null,
        }),
      ),
    );
    const draft = await generateProgramDraft(UTTERANCE);
    expect(draft).toMatchObject({ source: 'local', fallback: 'invalid-response' });
  });

  it('Server 가 실패하고 로컬 규칙도 못 알아들으면 안내 문구로 실패한다(블록을 만들지 않는다)', async () => {
    server.use(http.post(DRAFTS, () => failure(503, 'AI_UNAVAILABLE')));
    await expect(generateProgramDraft('ㅁㄴㅇㄹ')).rejects.toThrow();
  });

  it('요청 타임아웃은 6초(계약 §4: Server 상한 5초 + 여유)', async () => {
    const post = vi
      .spyOn(api, 'post')
      .mockRejectedValue(new ApiError('timeout of 6000ms exceeded'));
    const draft = await generateProgramDraft(UTTERANCE);
    expect(AI_REQUEST_TIMEOUT_MS).toBe(6_000);
    expect(post).toHaveBeenCalledWith(
      '/api/v1/ai/program-drafts',
      { utterance: UTTERANCE },
      expect.objectContaining({ timeout: 6_000 }),
    );
    // 타임아웃(상태 코드 없는 ApiError)도 unavailable 로 보고 로컬 규칙으로 대신한다.
    expect(draft).toMatchObject({ source: 'local', fallback: 'unavailable' });
  });
});

describe('remote 힌트 — Server S1-hint 응답별 동작', () => {
  const request = {
    programLines: ['앞으로 3m 이동', '앞으로 3m 이동'],
    violationCode: 'exceeds-safe-zone' as const,
    violationBlockNumber: 2,
  };

  it('200 → remote 메시지를 쓴다', async () => {
    server.use(
      http.post(HINTS, () =>
        HttpResponse.json({ success: true, data: { message: '거리를 줄여 볼까요?' }, error: null }),
      ),
    );
    await expect(generateHint(request)).resolves.toEqual({
      message: '거리를 줄여 볼까요?',
      source: 'remote',
    });
  });

  it('503 → 로컬 규칙 힌트(unavailable)', async () => {
    server.use(http.post(HINTS, () => failure(503, 'AI_UNAVAILABLE')));
    const hint = await generateHint(request);
    expect(hint).toMatchObject({ source: 'local', fallback: 'unavailable' });
    expect(hint.message).toContain('2번째 블록');
  });

  it('네트워크 오류 → 로컬 규칙 힌트(unavailable)', async () => {
    server.use(http.post(HINTS, () => HttpResponse.error()));
    await expect(generateHint(request)).resolves.toMatchObject({
      source: 'local',
      fallback: 'unavailable',
    });
  });

  it('보내는 요청은 계약 한도(40줄·줄당 100자·메시지 300자)에 맞추고, invalid-values 코드는 빼고 보낸다', async () => {
    let body: unknown;
    server.use(
      http.post(HINTS, async ({ request: req }) => {
        body = await req.json();
        return HttpResponse.json({ success: true, data: { message: '힌트' }, error: null });
      }),
    );
    await generateHint({
      programLines: Array.from({ length: 50 }, () => 'a'.repeat(150)),
      violationCode: 'invalid-values',
      violationMessage: 'b'.repeat(400),
    });
    const sent = body as Record<string, unknown> & { programLines: string[] };
    expect(sent.programLines).toHaveLength(40);
    expect(sent.programLines.every((line) => line.length === 100)).toBe(true);
    expect(sent.violationCode).toBeUndefined();
    expect((sent.violationMessage as string).length).toBe(300);
  });
});

describe('보조 함수', () => {
  it('toRemoteHintRequest 는 없는 필드를 만들지 않는다', () => {
    expect(toRemoteHintRequest({ programLines: ['x'] })).toEqual({ programLines: ['x'] });
  });

  it('fallbackReasonOf — 400 만 rejected, 나머지는 unavailable', () => {
    expect(fallbackReasonOf(new ApiError('x', 400))).toBe('rejected');
    expect(fallbackReasonOf(new ApiError('x', 503))).toBe('unavailable');
    expect(fallbackReasonOf(new ApiError('x'))).toBe('unavailable');
    expect(fallbackReasonOf(new Error('x'))).toBe('unavailable');
  });
});
