const STORAGE_KEY = 'poppy.session.credentials';

export type StoredSessionCredentials = {
  sessionId: string;
  sessionToken: string;
  recoveryCode: string;
  currentBlockVersion: number;
};

// localStorage 가 막히면(사파리 프라이빗 모드, 저장 공간 초과 등) writeSessionCredentials 가
// 조용히 실패하는데, 그때도 이번 탭 안에서는 계속 쓸 수 있어야 한다 — 안 그러면 세션 생성
// 응답으로 막 받은 유효한 credential 인데도 바로 다음 인증 호출부터 끊긴다(코드리뷰 발견).
let memoryCredentials: StoredSessionCredentials | null = null;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSessionCredentials(): StoredSessionCredentials | null {
  const store = storage();
  if (store) {
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const value = JSON.parse(raw) as Partial<StoredSessionCredentials>;
        if (
          typeof value.sessionId === 'string' &&
          typeof value.sessionToken === 'string' &&
          typeof value.recoveryCode === 'string' &&
          typeof value.currentBlockVersion === 'number'
        ) {
          return value as StoredSessionCredentials;
        }
      }
    } catch {
      // localStorage 를 못 믿겠으면 메모리 캐시로 넘어간다.
    }
  }
  return memoryCredentials;
}

export function writeSessionCredentials(credentials: StoredSessionCredentials): void {
  memoryCredentials = credentials;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // 저장 실패해도 이번 탭은 메모리 캐시로 계속 동작한다 — credential 을 노출하지는 않는다.
  }
}

export function clearSessionCredentials(): void {
  memoryCredentials = null;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

/** 테스트 전용 — 모듈 스코프 메모리 캐시는 localStorage 와 달리 테스트 간에 자동으로 안 비워진다. */
export function __resetSessionCredentialsForTests(): void {
  memoryCredentials = null;
}

export function sessionAuthHeaders(sessionId?: string): Record<string, string> {
  const credentials = readSessionCredentials();
  if (!credentials || (sessionId && credentials.sessionId !== sessionId)) {
    throw new Error('An active session credential is required');
  }
  return { 'X-Session-Token': credentials.sessionToken };
}
