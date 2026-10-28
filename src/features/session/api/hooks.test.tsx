import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { writeSessionCredentials } from '@/shared/api';
import { server } from '@/shared/api/msw/server';
import type { SerializedBlockProgram } from '@/features/simulation';

import { readLocalDraft } from '../lib/localDraft';
import { useAutoSaveProject } from './hooks';

const PROGRAM: SerializedBlockProgram = {
  chain: [
    { id: 's', kind: 'start' },
    { id: 'w', kind: 'wait', seconds: 1 },
    { id: 'e', kind: 'end' },
  ],
  detached: [],
};

function setup(sessionId: string | null = 'sess-1') {
  if (sessionId) {
    writeSessionCredentials({
      sessionId,
      sessionToken: `token-${sessionId}`,
      recoveryCode: 'R',
      currentBlockVersion: 0,
    });
  }
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useAutoSaveProject(sessionId), { wrapper });
  return { hook, queryClient };
}

const errorBody = (code: string) => ({ success: false, data: null, error: { code, message: 'x' } });

describe('useAutoSaveProject — 저장 상태 분리', () => {
  it('구조 오류 프로그램은 서버에 보내지 않고 invalid 로 브라우저에만 보관한다', () => {
    let requested = false;
    server.use(
      http.post('*/api/v1/sessions/:id/block-revisions', () => {
        requested = true;
        return HttpResponse.json({});
      }),
    );
    const { hook } = setup();
    act(() => hook.result.current.keepLocal(PROGRAM, { marker: 1 }));
    expect(hook.result.current.status).toBe('invalid');
    expect(requested).toBe(false);
    expect(readLocalDraft()).toMatchObject({ dirty: true, blocks: { marker: 1 } });
  });

  it('연결 안 된 블록이 섞여 변환할 수 없으면 요청 없이 invalid', async () => {
    const { hook } = setup();
    act(() =>
      hook.result.current.save({ ...PROGRAM, detached: [{ id: 'x', kind: 'wait', seconds: 1 }] }),
    );
    await waitFor(() => expect(hook.result.current.status).toBe('invalid'));
  });

  it('서버 5xx 는 offline', async () => {
    server.use(
      http.post('*/api/v1/sessions/:id/block-revisions', () =>
        HttpResponse.json(errorBody('COMMON_500'), { status: 500 }),
      ),
    );
    const { hook } = setup();
    act(() => hook.result.current.save(PROGRAM));
    await waitFor(() => expect(hook.result.current.status).toBe('offline'));
    expect(hook.result.current.rejectReason).toBeNull();
  });

  it('네트워크 오류는 offline', async () => {
    server.use(http.post('*/api/v1/sessions/:id/block-revisions', () => HttpResponse.error()));
    const { hook } = setup();
    act(() => hook.result.current.save(PROGRAM));
    await waitFor(() => expect(hook.result.current.status).toBe('offline'));
  });

  it('서버 4xx 는 rejected + 짧은 한국어 사유', async () => {
    server.use(
      http.post('*/api/v1/sessions/:id/block-revisions', () =>
        HttpResponse.json(errorBody('BLOCK_PROGRAM_INVALID'), { status: 400 }),
      ),
    );
    const { hook } = setup();
    act(() => hook.result.current.save(PROGRAM));
    await waitFor(() => expect(hook.result.current.status).toBe('rejected'));
    expect(hook.result.current.rejectReason).toBe(
      '블록 구성이 올바르지 않아요. 블록 값을 확인해 주세요.',
    );
  });

  it('409 는 conflict', async () => {
    server.use(
      http.post('*/api/v1/sessions/:id/block-revisions', () =>
        HttpResponse.json(errorBody('COMMON_409'), { status: 409 }),
      ),
    );
    const { hook } = setup();
    act(() => hook.result.current.save(PROGRAM));
    await waitFor(() => expect(hook.result.current.status).toBe('conflict'));
  });

  it.each([401, 404, 410])(
    '세션 %i 이면 새 세션을 만들어 현재 블록을 다시 저장한다',
    async (lostStatus) => {
      const savedTo: string[] = [];
      server.use(
        http.post('*/api/v1/sessions', () =>
          HttpResponse.json({
            success: true,
            data: {
              sessionId: 'sess-new',
              sessionToken: 'token-new',
              currentBlockVersion: 0,
              recoveryCode: 'R-NEW',
            },
            error: null,
          }),
        ),
        http.post('*/api/v1/sessions/:id/block-revisions', ({ params }) => {
          savedTo.push(String(params.id));
          if (params.id === 'sess-1') {
            return HttpResponse.json(errorBody('SESSION_NOT_FOUND'), { status: lostStatus });
          }
          return HttpResponse.json({
            success: true,
            data: { sessionId: 'sess-new', blockVersion: 1 },
            error: null,
          });
        }),
      );
      const { hook, queryClient } = setup();
      act(() => hook.result.current.save(PROGRAM));

      await waitFor(() => expect(hook.result.current.status).toBe('saved'));
      expect(savedTo).toEqual(['sess-1', 'sess-new']);
      expect(hook.result.current.projectVersion).toBe(1);
      expect(queryClient.getQueryData(['session'])).toMatchObject({ sessionId: 'sess-new' });
      // 복구로 만든 세션의 기준 버전은 바깥에서 다시 덮어쓰지 않는다
      let applied = true;
      act(() => {
        applied = hook.result.current.setBaseVersion(0, 'sess-new');
      });
      expect(applied).toBe(false);
      expect(hook.result.current.projectVersion).toBe(1);
    },
  );

  it('새 세션 생성도 실패하면 offline', async () => {
    server.use(
      http.post('*/api/v1/sessions', () => HttpResponse.error()),
      http.post('*/api/v1/sessions/:id/block-revisions', () =>
        HttpResponse.json(errorBody('SESSION_TOKEN_INVALID'), { status: 401 }),
      ),
    );
    const { hook } = setup();
    act(() => hook.result.current.save(PROGRAM));
    await waitFor(() => expect(hook.result.current.status).toBe('offline'));
  });
});
