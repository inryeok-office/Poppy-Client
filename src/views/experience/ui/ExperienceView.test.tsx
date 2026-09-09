import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ExperienceView } from './ExperienceView';

describe('ExperienceView', () => {
  it('주요 영역의 앵커 텍스트를 렌더링한다', () => {
    render(<ExperienceView />);

    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument();
    expect(screen.getByText('튜토리얼')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로봇 미리보기' })).toBeInTheDocument();
  });

  it('시뮬레이션 통과 전에는 로봇 실행하기가 잠겨 있다', () => {
    render(<ExperienceView />);

    const run = screen.getByRole('button', { name: /로봇 실행하기/ });
    expect(run).toHaveTextContent('잠김');
    expect(run).toHaveAttribute('aria-disabled');
  });

  it('시뮬레이션을 통과하면 로봇 실행하기가 활성화되고 튜토리얼이 사라진다', async () => {
    const user = userEvent.setup();
    render(<ExperienceView />);

    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: '로봇 실행하기' })).toHaveClass('bg-primary');
      },
      { timeout: 2000 },
    );
    expect(screen.getByRole('button', { name: '로봇 실행하기' })).not.toHaveTextContent('잠김');
    expect(screen.queryByText('튜토리얼')).not.toBeInTheDocument();
  });

  it('처음으로를 누르면 통과 기록이 초기화되어 다시 잠긴다', async () => {
    const user = userEvent.setup();
    render(<ExperienceView />);

    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));
    await waitFor(
      () => expect(screen.getByRole('button', { name: '로봇 실행하기' })).toBeInTheDocument(),
      { timeout: 2000 },
    );
    await user.click(screen.getByRole('button', { name: '처음으로' }));

    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
  });
});
