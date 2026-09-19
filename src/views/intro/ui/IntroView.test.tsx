import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import {
  createSession,
  readCachedSessionId,
  readLocalDraft,
  writeLocalDraft,
} from '@/features/session';

import { IntroView } from './IntroView';

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IntroView />
    </QueryClientProvider>,
  );
}

afterEach(() => push.mockClear());

describe('IntroView', () => {
  it('타이틀과 Poppy 로고를 렌더링한다', () => {
    renderView();

    expect(screen.getByText('로봇개 조종 체험')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Poppy' })).toBeInTheDocument();
  });

  it('CTA가 체험 화면(/experience)으로 연결된다', () => {
    renderView();

    // 실제 내비게이션 동작은 e2e에서 검증한다(jsdom은 라우팅을 수행하지 않음).
    expect(screen.getByRole('link', { name: /체험하러 가기/ })).toHaveAttribute(
      'href',
      '/experience',
    );
  });

  describe('복구 코드로 이어하기 (Figma Slide 8·9, 명세 "세션 복구")', () => {
    it('코드를 입력하기 전에는 이어 체험 하러 가기 버튼이 비활성이다', () => {
      renderView();

      expect(screen.getByRole('button', { name: '이어 체험 하러 가기' })).toBeDisabled();
    });

    it('유효한 복구 코드를 입력하면 세션을 되찾고 체험 화면으로 이동한다', async () => {
      const user = userEvent.setup();
      const session = await createSession();
      // 다른(이전) 세션의 로컬 임시본이 남아 있는 상태를 흉내낸다 — 복구 후에도 남아 있으면
      // ExperienceView 가 이걸 방금 복구한 세션 것인 양 이어서 자동 저장해 버린다.
      writeLocalDraft({
        sessionId: 'stale-session',
        program: { chain: [], detached: [] },
        projectVersion: 0,
        dirty: true,
      });
      renderView();

      await user.type(screen.getByPlaceholderText('복구 코드 입력'), session.recoveryCode);
      await user.click(screen.getByRole('button', { name: '이어 체험 하러 가기' }));

      await waitFor(() => expect(push).toHaveBeenCalledWith('/experience'));
      // 복구한 세션이 "현재 세션"으로 고정돼야 다음 화면에서 새 세션으로 덮어써지지 않는다.
      expect(readCachedSessionId()).toBe(session.sessionId);
      // 이전 세션의 로컬 임시본은 지워져야 한다.
      expect(readLocalDraft()).toBeNull();
    });

    it('잘못된 복구 코드는 오류 안내를 보여주고 이동하지 않는다', async () => {
      const user = userEvent.setup();
      renderView();

      await user.type(screen.getByPlaceholderText('복구 코드 입력'), '없는-코드');
      await user.click(screen.getByRole('button', { name: '이어 체험 하러 가기' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('복구 코드를 다시 확인해 주세요.');
      expect(push).not.toHaveBeenCalled();
    });
  });
});
