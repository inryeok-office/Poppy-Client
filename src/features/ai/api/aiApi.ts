// AI Server 계약 (docs/ai-assistant.md) — 브라우저는 이 두 엔드포인트만 호출한다.
// LLM 키·모델 선택은 전부 Server 가 들고 있다 (명세: "LLM 키는 Client에 두지 않는다").

import { api, type ApiResponse } from '@/shared/api';

import type { AiHintRequest } from '../model/types';

export type AiProgramDraftResponse = { steps: unknown; explanation: string };
export type AiHintResponse = { message: string };

export async function requestAiProgramDraft(utterance: string): Promise<AiProgramDraftResponse> {
  const response = await api.post<ApiResponse<AiProgramDraftResponse>>(
    '/api/v1/ai/program-drafts',
    {
      utterance,
    },
  );
  return response.data.data;
}

export async function requestAiHint(request: AiHintRequest): Promise<AiHintResponse> {
  const response = await api.post<ApiResponse<AiHintResponse>>('/api/v1/ai/hints', request);
  return response.data.data;
}
