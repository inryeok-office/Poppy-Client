// AI 초안·힌트 mutation 훅. 모드에 따라 Server 를 먼저 시도하고, off/실패/검증 실패면
// 항상 로컬 규칙 기반으로 대신한다(명세: "원격 응답은 신뢰하지 않는다").

import { useMutation } from '@tanstack/react-query';

import { requestAiHint, requestAiProgramDraft } from './aiApi';
import { getAiMode } from '../lib/mode';
import { hintFromViolation } from '../model/hints';
import { planFromUtterance } from '../model/planner';
import type { AiHint, AiHintRequest, AiProgramDraft } from '../model/types';
import { validateAiSteps } from '../model/validate';

export async function generateProgramDraft(utterance: string): Promise<AiProgramDraft> {
  if (getAiMode() === 'remote') {
    try {
      const response = await requestAiProgramDraft(utterance);
      const validated = validateAiSteps(response.steps);
      if (validated.ok) {
        return { steps: validated.steps, explanation: response.explanation, source: 'remote' };
      }
    } catch {
      // 원격 호출 실패 — 아래에서 로컬 planner 로 대신한다.
    }
  }
  const local = planFromUtterance(utterance);
  if (!local.ok) throw new Error(local.reason);
  return { steps: local.draft.steps, explanation: local.draft.explanation, source: 'local' };
}

export function useGenerateAiProgramDraft() {
  return useMutation({ mutationFn: generateProgramDraft });
}

export async function generateHint(request: AiHintRequest): Promise<AiHint> {
  if (getAiMode() === 'remote') {
    try {
      const response = await requestAiHint(request);
      if (typeof response.message === 'string' && response.message.trim().length > 0) {
        return { message: response.message, source: 'remote' };
      }
    } catch {
      // 원격 호출 실패 — 아래에서 로컬 규칙 기반 힌트로 대신한다.
    }
  }
  return hintFromViolation(request);
}

export function useGenerateAiHint() {
  return useMutation({ mutationFn: generateHint });
}
