import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { readSessionCredentials, writeSessionCredentials } from '@/shared/api';
import { server } from '@/shared/api/msw/server';

import { useSession, useStartNewExperience } from '../api/hooks';
import { EXPERIENCE_IDLE_TIMEOUT_MS, expireIdleExperience } from './experienceLifecycle';
import {
  readCachedSessionId,
  readLastActivityAt,
  readLocalDraft,
  touchExperienceActivity,
  writeCachedSessionId,
  writeLocalDraft,
} from './localDraft';

const NOW = 1_800_000_000_000;

function seedLeftovers(sessionId = 'old-session') {
  writeLocalDraft({
    sessionId,
    program: { chain: [], detached: [] },
    projectVersion: 3,
    dirty: true,
  });
  writeCachedSessionId(sessionId);
  writeSessionCredentials({
    sessionId,
    sessionToken: 'old-token',
    recoveryCode: 'R',
    currentBlockVersion: 3,
  });
}

const nothingLeft = () =>
  readLocalDraft() === null &&
  readCachedSessionId() === null &&
  readSessionCredentials() === null &&
  readLastActivityAt() === null;

describe('expireIdleExperience — 15분 자동 만료', () => {
  it('마지막 활동 후 15분 이내면 그대로 둔다 (새로고침해도 작업 유지)', () => {
    seedLeftovers();
    touchExperienceActivity(NOW - EXPERIENCE_IDLE_TIMEOUT_MS);
    expect(expireIdleExperience(NOW)).toBe(false);
    expect(readLocalDraft()).not.toBeNull();
    expect(readSessionCredentials()).not.toBeNull();
  });

  it('15분이 지나면 초안·세션 ID·credential·활동 시각을 모두 지운다', () => {
    seedLeftovers();
    touchExperienceActivity(NOW - EXPERIENCE_IDLE_TIMEOUT_MS - 1);
    expect(expireIdleExperience(NOW)).toBe(true);
    expect(nothingLeft()).toBe(true);
  });

  it('활동 시각 없이 남은 기록(이전 버전)은 이전 체험자의 것으로 보고 지운다', () => {
    seedLeftovers();
    localStorage.removeItem('poppy.experience.lastActivityAt');
    expect(expireIdleExperience(NOW)).toBe(true);
    expect(nothingLeft()).toBe(true);
  });

  it('남은 기록이 없으면 아무것도 하지 않는다', () => {
    expect(expireIdleExperience(NOW)).toBe(false);
  });
});

function sessionHook(
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
}

const created = {
  success: true,
  data: {
    sessionId: 'new-session',
    sessionToken: 'new-token',
    currentBlockVersion: 0,
    recoveryCode: 'N',
  },
  error: null,
};

describe('useSession — 저장된 세션을 Server 에 확인', () => {
  it.each([401, 404, 410])(
    'Server 가 %i 이면 조용히 지우고 새 세션을 만든다 (초안은 유지)',
    async (status) => {
      seedLeftovers();
      touchExperienceActivity();
      server.use(
        http.get('*/api/v1/sessions/:id', () =>
          HttpResponse.json(
            { success: false, data: null, error: { code: 'SESSION_NOT_FOUND' } },
            { status },
          ),
        ),
        http.post('*/api/v1/sessions', () => HttpResponse.json(created, { status: 201 })),
      );
      const { wrapper } = sessionHook();
      const { result } = renderHook(() => useSession(), { wrapper });

      await waitFor(() => expect(result.current.data?.sessionId).toBe('new-session'));
      expect(readCachedSessionId()).toBe('new-session');
      expect(readSessionCredentials()?.sessionId).toBe('new-session');
      expect(readLocalDraft()).not.toBeNull();
    },
  );

  it('Server 가 EXPIRED 라고 답해도 새 세션을 만든다', async () => {
    seedLeftovers();
    touchExperienceActivity();
    server.use(
      http.get('*/api/v1/sessions/:id', () =>
        HttpResponse.json({
          success: true,
          data: { sessionId: 'old-session', blockVersion: 3, status: 'EXPIRED' },
          error: null,
        }),
      ),
      http.post('*/api/v1/sessions', () => HttpResponse.json(created, { status: 201 })),
    );
    const { wrapper } = sessionHook();
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.data?.sessionId).toBe('new-session'));
  });

  it('살아 있는 세션은 그대로 이어 쓰고 Server 의 블록 버전을 쓴다', async () => {
    seedLeftovers();
    touchExperienceActivity();
    server.use(
      http.get('*/api/v1/sessions/:id', () =>
        HttpResponse.json({
          success: true,
          data: { sessionId: 'old-session', blockVersion: 5, status: 'ACTIVE' },
          error: null,
        }),
      ),
    );
    const { wrapper } = sessionHook();
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.data?.sessionId).toBe('old-session'));
    expect(result.current.data?.projectVersion).toBe(5);
  });

  it('네트워크 오류면 저장된 세션을 그대로 쓴다 (오프라인 보관)', async () => {
    seedLeftovers();
    touchExperienceActivity();
    server.use(http.get('*/api/v1/sessions/:id', () => HttpResponse.error()));
    const { wrapper } = sessionHook();
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.data?.sessionId).toBe('old-session'));
  });

  it('15분 넘게 지난 기록이면 확인 없이 새 세션으로 시작한다', async () => {
    seedLeftovers();
    touchExperienceActivity(Date.now() - EXPERIENCE_IDLE_TIMEOUT_MS - 1000);
    server.use(http.post('*/api/v1/sessions', () => HttpResponse.json(created, { status: 201 })));
    const { wrapper } = sessionHook();
    const { result } = renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.data?.sessionId).toBe('new-session'));
    expect(readLocalDraft()).toBeNull();
  });
});

describe('useStartNewExperience — 새 체험 시작', () => {
  it('초안·세션을 모두 지우고 메모리의 세션 캐시도 버린다', () => {
    seedLeftovers();
    touchExperienceActivity();
    const { queryClient, wrapper } = sessionHook();
    queryClient.setQueryData(['session'], { sessionId: 'old-session' });
    const { result } = renderHook(() => useStartNewExperience(), { wrapper });

    act(() => result.current());

    expect(nothingLeft()).toBe(true);
    expect(queryClient.getQueryData(['session'])).toBeUndefined();
  });
});
