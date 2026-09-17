import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetSessionCredentialsForTests,
  clearSessionCredentials,
  readSessionCredentials,
  sessionAuthHeaders,
  writeSessionCredentials,
  type StoredSessionCredentials,
} from './sessionCredentials';

const credentials: StoredSessionCredentials = {
  sessionId: 'sess-1',
  sessionToken: 'token-1',
  recoveryCode: 'code-1',
  currentBlockVersion: 3,
};

// 모듈 스코프 메모리 캐시는 localStorage 와 달리 vitest.setup 의 afterEach 로 안 비워진다.
beforeEach(() => __resetSessionCredentialsForTests());
afterEach(() => {
  __resetSessionCredentialsForTests();
  vi.restoreAllMocks();
});

describe('sessionCredentials — localStorage 정상 동작', () => {
  it('쓰면 그대로 읽힌다', () => {
    writeSessionCredentials(credentials);
    expect(readSessionCredentials()).toEqual(credentials);
  });

  it('지우면 못 읽는다', () => {
    writeSessionCredentials(credentials);
    clearSessionCredentials();
    expect(readSessionCredentials()).toBeNull();
  });

  it('저장된 게 없으면 null', () => {
    expect(readSessionCredentials()).toBeNull();
  });
});

describe('sessionCredentials — localStorage 를 못 쓸 때 메모리로 대체 (코드리뷰: 저장 실패해도 credential 유지)', () => {
  it('쓰기가 실패해도(용량 초과 등) 이번 탭에서는 계속 읽힌다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('용량 초과', 'QuotaExceededError');
    });

    expect(() => writeSessionCredentials(credentials)).not.toThrow();
    expect(readSessionCredentials()).toEqual(credentials);
  });

  it('읽기가 실패해도(사파리 프라이빗 모드 등) 메모리 캐시로 대체한다', () => {
    writeSessionCredentials(credentials); // 정상 저장 — 메모리에도 남는다
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('접근 차단', 'SecurityError');
    });

    expect(readSessionCredentials()).toEqual(credentials);
  });

  it('sessionAuthHeaders 도 메모리 캐시로 계속 동작한다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    writeSessionCredentials(credentials);

    expect(sessionAuthHeaders(credentials.sessionId)).toEqual({ 'X-Session-Token': 'token-1' });
  });

  it('clearSessionCredentials 는 메모리 캐시도 지운다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });
    writeSessionCredentials(credentials);

    clearSessionCredentials();

    expect(readSessionCredentials()).toBeNull();
  });
});

describe('sessionCredentials — 정상적으로 지워진 세션은 메모리 캐시로 되살리지 않는다 (코드리뷰: SECURITY)', () => {
  it('localStorage 가 정상적으로 비어 있으면(다른 탭 로그아웃 등) 메모리 캐시가 있어도 null', () => {
    writeSessionCredentials(credentials);
    window.localStorage.clear(); // getItem 이 예외 없이 null 을 돌려주는 정상적인 삭제 상황

    expect(readSessionCredentials()).toBeNull();
  });

  it('storage 이벤트로 다른 탭의 삭제를 감지하면 이 탭의 메모리 캐시도 비운다', () => {
    writeSessionCredentials(credentials);

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'poppy.session.credentials', newValue: null }),
    );

    // 이후 storage 접근 자체가 막혀도(과거엔 메모리로 대체했을 상황) 지워진 채로 남아야 한다.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('접근 차단', 'SecurityError');
    });
    expect(readSessionCredentials()).toBeNull();
  });
});

describe('__resetSessionCredentialsForTests', () => {
  it('메모리 캐시를 초기화해 테스트 간에 새지 않게 한다', () => {
    writeSessionCredentials(credentials);
    __resetSessionCredentialsForTests();
    window.localStorage.clear();

    expect(readSessionCredentials()).toBeNull();
  });
});
