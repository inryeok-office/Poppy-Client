import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExperienceView } from './ExperienceView';

describe('ExperienceView', () => {
  it('주요 영역의 앵커 텍스트를 렌더링한다', () => {
    render(<ExperienceView />);

    // 헤더
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument();
    // 워크스페이스
    expect(screen.getByText('튜토리얼')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toBeInTheDocument();
    // 로봇 미리보기
    expect(screen.getByRole('heading', { name: '로봇 미리보기' })).toBeInTheDocument();
  });

  it('시뮬레이션 통과 전이라 로봇 실행 버튼은 잠겨 있다', () => {
    render(<ExperienceView />);

    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toBeDisabled();
  });
});
