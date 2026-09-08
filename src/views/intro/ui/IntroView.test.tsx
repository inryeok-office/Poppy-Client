import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IntroView } from './IntroView';

describe('IntroView', () => {
  it('타이틀과 Poppy 로고를 렌더링한다', () => {
    render(<IntroView />);

    expect(screen.getByText('로봇개 조종 체험')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Poppy' })).toBeInTheDocument();
  });

  it('CTA 버튼을 노출한다', () => {
    render(<IntroView />);

    expect(screen.getByRole('button', { name: /체험하러 가기/ })).toBeInTheDocument();
  });
});
