import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { IntroView } from './IntroView';

describe('IntroView', () => {
  it('타이틀과 Poppy 로고를 렌더링한다', () => {
    render(<IntroView />);

    expect(screen.getByText('로봇개 조종 체험')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Poppy' })).toBeInTheDocument();
  });

  it('CTA가 체험 화면(/experience)으로 연결된다', () => {
    render(<IntroView />);

    // 실제 내비게이션 동작은 e2e에서 검증한다(jsdom은 라우팅을 수행하지 않음).
    expect(screen.getByRole('link', { name: /체험하러 가기/ })).toHaveAttribute(
      'href',
      '/experience',
    );
  });
});
