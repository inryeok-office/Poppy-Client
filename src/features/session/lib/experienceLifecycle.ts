import { clearSessionCredentials, readSessionCredentials } from '@/shared/api';

import {
  clearCachedSessionId,
  clearExperienceActivity,
  clearExperienceFlags,
  clearLocalDraft,
  readCachedSessionId,
  readLastActivityAt,
  readLocalDraft,
} from './localDraft';

// 행사장 공용 PC 에서 한 체험자의 기록(블록 초안·세션 credential)이 다음 체험자에게 넘어가지 않게 한다.
//   · 새 체험 시작(인트로 '체험하러 가기'·'미션 골라서 도전하기', '처음으로', '다음 체험자 시작')은 모두 지운다.
//   · 마지막 활동 후 EXPERIENCE_IDLE_TIMEOUT_MS 가 지나면 다음 진입 때 지운다.
//   · 그 안의 새로고침(F5)은 같은 체험으로 보고 그대로 이어간다.
//   · 이어하기는 인트로의 '복구 코드' 입력으로만 한다.

/** 마지막 활동 후 이 시간이 지나면 다음 진입 때 로컬 초안·세션을 버린다 (15분). */
export const EXPERIENCE_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/** 이 브라우저에 남은 체험 기록(초안·세션 ID·credential·활동 시각)을 모두 지운다. */
export function resetExperienceStorage(): void {
  clearLocalDraft();
  clearCachedSessionId();
  clearSessionCredentials();
  clearExperienceActivity();
  clearExperienceFlags();
}

/**
 * 오래된 체험 기록이면 지우고 true. 활동 시각 없이 기록만 남은 경우(이 기능 이전의 기록)도
 * 이전 체험자의 것으로 보고 지운다.
 */
export function expireIdleExperience(now: number = Date.now()): boolean {
  const last = readLastActivityAt();
  const hasLeftovers =
    readLocalDraft() !== null ||
    readCachedSessionId() !== null ||
    readSessionCredentials() !== null;
  if (!hasLeftovers) return false;
  if (last !== null && now - last <= EXPERIENCE_IDLE_TIMEOUT_MS) return false;
  resetExperienceStorage();
  return true;
}
