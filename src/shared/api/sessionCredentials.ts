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
// 단, 이 캐시는 "이 탭에서 직전 쓰기가 실패했을 때"만 빈 읽기를 대신한다 — 그냥 정상적으로
// 빈 걸 읽었다면(다른 탭의 로그아웃 등) 그대로 세션 없음으로 처리해야 한다. 안 그러면
// 다른 탭에서 지운 세션의 credential 이 이 탭에서 계속 새는 보안 문제가 된다(코드리뷰 발견).
let memoryCredentials: StoredSessionCredentials | null = null;
let lastWriteFailed = false;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function parseCredentials(raw: string): StoredSessionCredentials | null {
  const value = JSON.parse(raw) as Partial<StoredSessionCredentials>;
  if (
    typeof value.sessionId === 'string' &&
    typeof value.sessionToken === 'string' &&
    typeof value.recoveryCode === 'string' &&
    typeof value.currentBlockVersion === 'number'
  ) {
    return value as StoredSessionCredentials;
  }
  return null;
}

export function readSessionCredentials(): StoredSessionCredentials | null {
  const store = storage();
  if (!store) return memoryCredentials;

  let raw: string | null;
  try {
    raw = store.getItem(STORAGE_KEY);
  } catch {
    // storage 접근 자체가 실패한 경우(사파리 프라이빗 모드 등)에만 메모리 캐시로 대체한다.
    return memoryCredentials;
  }

  // 여기까진 localStorage 를 정상적으로 읽은 것. 빈 값이면 — 방금 이 탭에서 쓰기가
  // 실패해 실제로 반영이 안 된 상태일 때만 메모리로 대신하고, 아니면(다른 탭의 정상적인
  // 로그아웃 등) 그대로 세션 없음으로 처리한다.
  if (!raw) return lastWriteFailed ? memoryCredentials : null;
  try {
    return parseCredentials(raw);
  } catch {
    return null;
  }
}

if (typeof window !== 'undefined') {
  // 다른 탭에서 세션이 지워지면 이 탭의 메모리 캐시도 같이 비운다(다중 탭 로그아웃).
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY && event.newValue === null) {
      memoryCredentials = null;
    }
  });
}

export function writeSessionCredentials(credentials: StoredSessionCredentials): void {
  memoryCredentials = credentials;
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(credentials));
    lastWriteFailed = false;
  } catch {
    // 저장 실패해도 이번 탭은 메모리 캐시로 계속 동작한다 — credential 을 노출하지는 않는다.
    lastWriteFailed = true;
  }
}

export function clearSessionCredentials(): void {
  memoryCredentials = null;
  lastWriteFailed = false;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

/** 테스트 전용 — 모듈 스코프 메모리 캐시는 localStorage 와 달리 테스트 간에 자동으로 안 비워진다. */
export function __resetSessionCredentialsForTests(): void {
  memoryCredentials = null;
  lastWriteFailed = false;
}

export function sessionAuthHeaders(sessionId?: string): Record<string, string> {
  const credentials = readSessionCredentials();
  if (!credentials || (sessionId && credentials.sessionId !== sessionId)) {
    throw new Error('An active session credential is required');
  }
  return { 'X-Session-Token': credentials.sessionToken };
}
