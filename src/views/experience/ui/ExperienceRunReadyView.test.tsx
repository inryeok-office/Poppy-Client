import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExperienceRunReadyView } from './ExperienceRunReadyView';

describe('ExperienceRunReadyView', () => {
  it('주요 영역의 앵커 텍스트를 렌더링한다', () => {
    render(<ExperienceRunReadyView />);

    // 헤더
    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument();
    // 워크스페이스
    expect(screen.getByText(/종료.*블록으로 끝내주세요/)).toBeInTheDocument();
    // 로봇 미리보기
    expect(screen.getByRole('heading', { name: '로봇 미리보기' })).toBeInTheDocument();
  });

  it('튜토리얼 패널이 없다', () => {
    render(<ExperienceRunReadyView />);

    expect(screen.queryByText('튜토리얼')).not.toBeInTheDocument();
  });

  it('시뮬레이션 하기·로봇 실행하기 둘 다 primary 버튼으로 활성화된다', () => {
    render(<ExperienceRunReadyView />);

    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toHaveClass('bg-primary');
    expect(screen.getByRole('button', { name: '로봇 실행하기' })).toHaveClass('bg-primary');
  });

  it('완성된 프로그램이 종료 블록까지 캔버스에 연결돼 있다', () => {
    render(<ExperienceRunReadyView />);

    const canvas = screen.getByRole('region', { name: '블록 조립 캔버스' });
    expect(canvas).toHaveTextContent('시작');
    expect(canvas).toHaveTextContent('종료');
    // 입력칸 값
    expect(canvas).toHaveTextContent('2');
    expect(canvas).toHaveTextContent('1');
  });
});
