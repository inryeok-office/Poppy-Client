import type { LocalDraft } from '../model/types';

// 프로젝트 초안을 브라우저에 임시 보관한다 (명세: "브라우저에도 임시 보관", "네트워크 실패 시 로컬 보관").
const KEY = 'poppy.experience.draft';
const SESSION_KEY = 'poppy.experience.sessionId';

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
  const store = safeLocalStorage();
  try {
    store?.setItem(KEY, JSON.stringify(draft));
  } catch {
    // 저장 공간 초과 등 — 무시 (서버 저장이 주 경로)
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
