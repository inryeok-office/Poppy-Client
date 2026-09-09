import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExperienceAssembledView } from './ExperienceAssembledView';

describe('ExperienceAssembledView', () => {
  it('주요 영역의 앵커 텍스트를 렌더링한다', () => {
    render(<ExperienceAssembledView />);

    // 헤더
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument();
    // 워크스페이스
    expect(screen.getByText('튜토리얼')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로봇 미리보기' })).toBeInTheDocument();
  });

  it('조립 완료 상태라 종료 블록까지 캔버스에 연결돼 있다', () => {
    render(<ExperienceAssembledView />);

    const canvas = screen.getByRole('region', { name: '블록 조립 캔버스' });
    expect(canvas).toHaveTextContent('시작');
    expect(canvas).toHaveTextContent('종료');
  });

  it('시뮬레이션 하기가 채워진 primary 버튼으로 활성화된다', () => {
    render(<ExperienceAssembledView />);

    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toHaveClass('bg-primary');
  });
});
