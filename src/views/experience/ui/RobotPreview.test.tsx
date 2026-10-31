import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RobotPreview } from './RobotPreview';

describe('RobotPreview — 프로그램 계산값 표시', () => {
  it('블록 수·예상 시간·자세·방향·이동 거리와 6m × 6m 안전 구역을 보여준다', () => {
    render(
      <RobotPreview
        blockCount={3}
        estimatedSeconds={6.2}
        finalPosture="sitting"
        headingDegrees={90}
        estimatedDistanceM={1.5}
        path={[
          { xM: 5.6, yM: 0.4 },
          { xM: 5.6, yM: 3.4 },
        ]}
      />,
    );
    expect(screen.getByText('블록 3개 • 예상 실행 7초')).toBeInTheDocument();
    expect(screen.getByText('앉기')).toBeInTheDocument();
    expect(screen.getByText('오른쪽 90°')).toBeInTheDocument();
    expect(screen.getByText('1.5 m')).toBeInTheDocument();
    expect(screen.getByText('안전 구역 6m × 6m')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /안전 구역 6m × 6m/ })).toBeInTheDocument();
    const toNumbers = (value: string | null) =>
      (value ?? '')
        .split(/[ ,()a-z]+/)
        .filter(Boolean)
        .map(Number);
    const [x1, y1, x2, y2] = toNumbers(screen.getByTestId('robot-path').getAttribute('points'));
    expect(x1).toBeCloseTo(161.33, 1);
    expect(y1).toBeCloseTo(158.33, 1);
    expect(x2).toBeCloseTo(161.33, 1);
    expect(y2).toBeCloseTo(78.33, 1);
    expect(screen.getByTestId('robot-heading').getAttribute('transform')).toMatch(/rotate\(90\)$/);
    expect(screen.queryByTestId('robot-failure-point')).not.toBeInTheDocument();
  });

  it('벗어난 지점을 표시한다', () => {
    render(<RobotPreview failurePoint={{ xM: 3, yM: 3 }} />);
    const point = screen.getByTestId('robot-failure-point');
    expect(Number(point.getAttribute('cx'))).toBeCloseTo(92);
    expect(Number(point.getAttribute('cy'))).toBeCloseTo(89);
  });

  it('기본값은 블록 0개, 서있기, 정면', () => {
    render(<RobotPreview />);
    expect(screen.getByText('블록 0개 • 예상 실행 0초')).toBeInTheDocument();
    expect(screen.getByText('서있기')).toBeInTheDocument();
    expect(screen.getByText('정면')).toBeInTheDocument();
  });
});
