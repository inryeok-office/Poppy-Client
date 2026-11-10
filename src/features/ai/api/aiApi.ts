// AI Server 계약 (~/poppy-ai shared AI_API.md S1 · docs/ai-assistant.md) — 브라우저는 이 두
// 엔드포인트만 호출한다. LLM 키·모델 선택은 전부 Server 가 들고 있다
// (명세: "LLM 키는 Client에 두지 않는다").

import { api, type ApiResponse } from '@/shared/api';

import type { AiHintRequest } from '../model/types';

export type AiProgramDraftResponse = { steps: unknown; explanation: unknown };
export type AiHintResponse = { message: unknown };

/** Server S1 상한은 5초. Client 는 6초를 넘기면 끊고 로컬 규칙으로 대신한다(계약 §4). */
export const AI_REQUEST_TIMEOUT_MS = 6_000;

/** 계약 §2.2 — 힌트 요청 한도. 넘는 부분은 보내기 전에 자른다(400 을 피한다). */
const HINT_MAX_LINES = 40;
const HINT_LINE_MAX_LENGTH = 100;
const HINT_MESSAGE_MAX_LENGTH = 300;
const REMOTE_VIOLATION_CODES = new Set([
  'exceeds-safe-zone',
  'exceeds-time',
  'moves-while-sitting',
]);

/** 힌트 요청을 계약 한도에 맞춘다. Server 가 모르는 위반 코드(invalid-values)는 빼고 보낸다. */
export function toRemoteHintRequest(request: AiHintRequest): AiHintRequest {
  const remote: AiHintRequest = {
    programLines: request.programLines
      .slice(0, HINT_MAX_LINES)
      .map((line) => line.slice(0, HINT_LINE_MAX_LENGTH)),
  };
  if (request.violationCode && REMOTE_VIOLATION_CODES.has(request.violationCode)) {
    remote.violationCode = request.violationCode;
  }
  if (request.violationMessage) {
    remote.violationMessage = request.violationMessage.slice(0, HINT_MESSAGE_MAX_LENGTH);
  }
  if (request.violationBlockNumber !== undefined) {
    remote.violationBlockNumber = request.violationBlockNumber;
  }
  return remote;
}

export async function requestAiProgramDraft(utterance: string): Promise<AiProgramDraftResponse> {
  const response = await api.post<ApiResponse<AiProgramDraftResponse>>(
    '/api/v1/ai/program-drafts',
    { utterance },
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return response.data.data;
}

export async function requestAiHint(request: AiHintRequest): Promise<AiHintResponse> {
  const response = await api.post<ApiResponse<AiHintResponse>>(
    '/api/v1/ai/hints',
    toRemoteHintRequest(request),
    { timeout: AI_REQUEST_TIMEOUT_MS },
  );
  return response.data.data;
}
