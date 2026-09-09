import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ExperienceView } from './ExperienceView';

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExperienceView />
    </QueryClientProvider>,
  );
}

const connectEndBlock = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '종료 블록 연결하기' }));

const waitForRunButton = () =>
  waitFor(
    () => expect(screen.getByRole('button', { name: '로봇 실행하기' })).toHaveClass('bg-primary'),
    { timeout: 3000 },
  );

describe('ExperienceView', () => {
  it('주요 영역의 앵커 텍스트를 렌더링한다', () => {
    renderView();

    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument();
    expect(screen.getByText('튜토리얼')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로봇 미리보기' })).toBeInTheDocument();
  });

  it('종료 블록이 연결되지 않으면 오류 안내와 함께 시뮬레이션이 막힌다', () => {
    renderView();

    expect(screen.getByText(/‘종료’ 블록을 연결/)).toBeInTheDocument();
    const simulate = screen.getByRole('button', { name: '시뮬레이션 하기' });
    expect(simulate).toHaveAttribute('aria-disabled');
    expect(simulate).not.toHaveClass('bg-primary');
  });

  it('떨어진 종료 블록을 연결하면 시뮬레이션이 활성화된다', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);

    const simulate = screen.getByRole('button', { name: '시뮬레이션 하기' });
    expect(simulate).toHaveClass('bg-primary');
    expect(simulate).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByRole('button', { name: '종료 블록 연결하기' })).not.toBeInTheDocument();
  });

  it('시뮬레이션 통과 전에는 로봇 실행하기가 잠겨 있다', () => {
    renderView();

    const run = screen.getByRole('button', { name: /로봇 실행하기/ });
    expect(run).toHaveTextContent('잠김');
    expect(run).toHaveAttribute('aria-disabled');
  });

  it('종료 연결 → 시뮬레이션(mock API) 통과 → 로봇 실행하기 활성 + 튜토리얼 제거', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    await waitForRunButton();
    expect(screen.getByRole('button', { name: '로봇 실행하기' })).not.toHaveTextContent('잠김');
    expect(screen.queryByText('튜토리얼')).not.toBeInTheDocument();
  });

  it('처음으로를 누르면 블록·통과 기록이 초기화된다', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));
    await waitForRunButton();

    await user.click(screen.getByRole('button', { name: '처음으로' }));

    expect(screen.getByRole('button', { name: '종료 블록 연결하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
  });
});
