import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { QuickStartBar } from './QuickStartBar';

afterEach(() => vi.restoreAllMocks());

describe('QuickStartBar', () => {
  it('템플릿 3개를 보여준다', () => {
    render(<QuickStartBar onApply={() => {}} />);
    expect(screen.getByRole('button', { name: '네모 걷기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ㄱ자 길' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인사하고 하트' })).toBeInTheDocument();
  });

  it('확인하면 onApply 를 그 템플릿 id로 부른다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<QuickStartBar onApply={onApply} />);

    await user.click(screen.getByRole('button', { name: '네모 걷기' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onApply).toHaveBeenCalledWith('squareWalk');
  });

  it('취소하면 onApply 를 부르지 않는다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onApply = vi.fn();
    const user = userEvent.setup();
    render(<QuickStartBar onApply={onApply} />);

    await user.click(screen.getByRole('button', { name: 'ㄱ자 길' }));
    expect(onApply).not.toHaveBeenCalled();
  });
});
