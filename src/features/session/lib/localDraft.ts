import type { LocalDraft } from '../model/types';

// 프로젝트 초안을 브라우저에 임시 보관한다 (명세: "브라우저에도 임시 보관", "네트워크 실패 시 로컬 보관").
const KEY = 'poppy.experience.draft';
const SESSION_KEY = 'poppy.experience.sessionId';
// 마지막 활동 시각 (epoch ms) — 공용 PC 에서 다음 체험자가 이전 기록을 이어받지 않게 자동 만료에 쓴다.
const ACTIVITY_KEY = 'poppy.experience.lastActivityAt';

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readLocalDraft(): LocalDraft | null {
  const store = safeLocalStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalDraft) : null;
  } catch {
    return null;
  }
}

export function writeLocalDraft(draft: LocalDraft): void {
  touchExperienceActivity();
  const store = safeLocalStorage();
  try {
    store?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 저장 공간 초과 등 — 무시 (서버 저장이 주 경로)
  }
}

export function touchExperienceActivity(now: number = Date.now()): void {
  try {
    safeLocalStorage()?.setItem(ACTIVITY_KEY, String(now));
  } catch {
    // 무시
  }
}

export function readLastActivityAt(): number | null {
  try {
    const raw = safeLocalStorage()?.getItem(ACTIVITY_KEY);
    const value = raw == null ? NaN : Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export function clearExperienceActivity(): void {
  try {
    safeLocalStorage()?.removeItem(ACTIVITY_KEY);
  } catch {
    // 무시
  }
}

// 체험 하나 동안만 유지하는 화면 상태(안내 띠 접기, 끌어오기 애니메이션 1회 등). 새 체험 시작 때 모두 지운다.
const FLAG_PREFIX = 'poppy.experience.flag.';

export function readExperienceFlag(name: string): boolean {
  try {
    return safeLocalStorage()?.getItem(FLAG_PREFIX + name) === '1';
  } catch {
    return false;
  }
}

export function writeExperienceFlag(name: string, value: boolean): void {
  try {
    const store = safeLocalStorage();
    if (value) store?.setItem(FLAG_PREFIX + name, '1');
    else store?.removeItem(FLAG_PREFIX + name);
  } catch {
    // 무시
  }
}

export function clearExperienceFlags(): void {
  try {
    const store = safeLocalStorage();
    if (!store) return;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i += 1) {
      const key = store.key(i);
      if (key?.startsWith(FLAG_PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // 무시
  }
}

export function clearCachedSessionId(): void {
  try {
    safeLocalStorage()?.removeItem(SESSION_KEY);
  } catch {
    // 무시
  }
}

export function clearLocalDraft(): void {
  try {
    safeLocalStorage()?.removeItem(KEY);
  } catch {
    // 무시
  }
}

export function readCachedSessionId(): string | null {
  try {
    return safeLocalStorage()?.getItem(SESSION_KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeCachedSessionId(sessionId: string): void {
  try {
    safeLocalStorage()?.setItem(SESSION_KEY, sessionId);
  } catch {
    // 무시
  }
}
