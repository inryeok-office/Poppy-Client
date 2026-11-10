// MSW dev mock — remote 모드를 로컬에서 테스트해 볼 수 있게, Server 가 없을 때 같은 계약으로
// planner/hint 결과를 돌려준다. 못 알아들은 문장은 계약(AI_API.md §3)대로 503 AI_UNAVAILABLE.
// 실제 Server LLM 이 생기면 이 핸들러만 걷어낸다.

import { HttpResponse, http } from 'msw';

import { hintFromViolation } from '../model/hints';
import { planFromUtterance } from '../model/planner';
import type { AiHintRequest } from '../model/types';

export const aiHandlers = [
  http.post('*/api/v1/ai/program-drafts', async ({ request }) => {
    const body = (await request.json()) as { utterance?: unknown };
    const utterance = typeof body.utterance === 'string' ? body.utterance : '';
    const result = planFromUtterance(utterance);
    if (!result.ok) {
      return HttpResponse.json(
        {
          success: false,
          data: null,
          error: { code: 'AI_UNAVAILABLE', message: result.reason, fieldErrors: [] },
        },
        { status: 503 },
      );
    }
    return HttpResponse.json({
      success: true,
      data: { steps: result.draft.steps, explanation: result.draft.explanation },
      error: null,
    });
  }),

  http.post('*/api/v1/ai/hints', async ({ request }) => {
    const body = (await request.json()) as AiHintRequest;
    const hint = hintFromViolation(body);
    return HttpResponse.json({ success: true, data: { message: hint.message }, error: null });
  }),
];
