// AI 초안·힌트 mutation 훅. remote 모드면 Server(S1)를 먼저 시도하고, 실패(503·5xx·400·
// 네트워크·타임아웃)나 검증 실패면 항상 로컬 규칙 기반으로 대신한다
// (명세: "원격 응답은 신뢰하지 않는다"). 대신한 이유는 fallback 에 남겨 화면에 출처를 보인다.

import { useMutation } from '@tanstack/react-query';

import { ApiError } from '@/shared/api';

import { requestAiHint, requestAiProgramDraft } from './aiApi';
import { getAiMode } from '../lib/mode';
import { hintFromViolation } from '../model/hints';
import { planFromUtterance } from '../model/planner';
import type { AiFallbackReason, AiHint, AiHintRequest, AiProgramDraft } from '../model/types';
import { validateAiSteps } from '../model/validate';

/** 계약 — explanation·message 는 1~200자. 넘으면 자르고, 비어 있으면 응답 형식 오류로 본다. */
const AI_TEXT_MAX_LENGTH = 200;

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, AI_TEXT_MAX_LENGTH) : null;
}

/** 원격 호출 오류를 대체 이유로 분류한다. 400 만 rejected, 나머지(503·5xx·네트워크·타임아웃)는
 *  unavailable. 어느 쪽이든 Client 동작(로컬 대체)은 같다. */
export function fallbackReasonOf(error: unknown): AiFallbackReason {
  if (error instanceof ApiError && error.status === 400) return 'rejected';
  return 'unavailable';
}

function localDraft(utterance: string, fallback?: AiFallbackReason): AiProgramDraft {
  const local = planFromUtterance(utterance);
  if (!local.ok) throw new Error(local.reason);
  return {
    steps: local.draft.steps,
    explanation: local.draft.explanation,
    source: 'local',
    ...(fallback ? { fallback } : {}),
  };
}

export async function generateProgramDraft(utterance: string): Promise<AiProgramDraft> {
  if (getAiMode() !== 'remote') return localDraft(utterance);

  let fallback: AiFallbackReason;
  try {
    const response = await requestAiProgramDraft(utterance);
    const validated = validateAiSteps(response?.steps);
    const explanation = cleanText(response?.explanation);
    if (validated.ok && explanation) {
      return { steps: validated.steps, explanation, source: 'remote' };
    }
    fallback = 'invalid-response';
  } catch (error) {
    fallback = fallbackReasonOf(error);
  }
  return localDraft(utterance, fallback);
}

export function useGenerateAiProgramDraft() {
  return useMutation({ mutationFn: generateProgramDraft });
}

export async function generateHint(request: AiHintRequest): Promise<AiHint> {
  if (getAiMode() !== 'remote') return hintFromViolation(request);

  let fallback: AiFallbackReason;
  try {
    const response = await requestAiHint(request);
    const message = cleanText(response?.message);
    if (message) return { message, source: 'remote' };
    fallback = 'invalid-response';
  } catch (error) {
    fallback = fallbackReasonOf(error);
  }
  return { ...hintFromViolation(request), fallback };
}

export function useGenerateAiHint() {
  return useMutation({ mutationFn: generateHint });
}
