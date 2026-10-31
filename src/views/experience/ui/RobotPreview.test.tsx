import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RobotPreview } from './RobotPreview';

describe('RobotPreview — 프로그램 계산값 표시', () => {
  it('블록 수·예상 시간·자세·방향·이동 거리와 4m × 4m 안전 구역을 보여준다', () => {
    render(
      <RobotPreview
        blockCount={3}
        estimatedSeconds={6.2}
        finalPosture="sitting"
        headingDegrees={90}
        estimatedDistanceM={1.5}
        path={[
          { xM: 2, yM: 0.4 },
          { xM: 2, yM: 1.9 },
        ]}
      />,
    );
    expect(screen.getByText('블록 3개 • 예상 실행 7초')).toBeInTheDocument();
    expect(screen.getByText('앉기')).toBeInTheDocument();
    expect(screen.getByText('오른쪽 90°')).toBeInTheDocument();
    expect(screen.getByText('1.5 m')).toBeInTheDocument();
    expect(screen.getByText('안전 구역 4m × 4m')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /안전 구역 4m × 4m/ })).toBeInTheDocument();
    expect(screen.getByTestId('robot-path')).toHaveAttribute('points', '92,153 92,93');
    expect(screen.getByTestId('robot-heading')).toHaveAttribute(
      'transform',
      'translate(92 93) rotate(90)',
    );
    expect(screen.queryByTestId('robot-failure-point')).not.toBeInTheDocument();
  });

  it('벗어난 지점을 표시한다', () => {
    render(<RobotPreview failurePoint={{ xM: 0.4, yM: 2.8 }} />);
    const point = screen.getByTestId('robot-failure-point');
    expect(Number(point.getAttribute('cx'))).toBeCloseTo(28);
    expect(Number(point.getAttribute('cy'))).toBeCloseTo(57);
  });

  it('기본값은 블록 0개, 서있기, 정면', () => {
    render(<RobotPreview />);
    expect(screen.getByText('블록 0개 • 예상 실행 0초')).toBeInTheDocument();
    expect(screen.getByText('서있기')).toBeInTheDocument();
    expect(screen.getByText('정면')).toBeInTheDocument();
  });
});
