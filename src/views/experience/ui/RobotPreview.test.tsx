import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DEFAULT_ARENA, planMotion } from '@/features/simulation';

import { GRID_STEP_M, RobotPreview } from './RobotPreview';

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

describe('RobotPreview — 실물 매트와 같은 격자·출발점 (#71)', () => {
  const PX_PER_M = 160 / 6;
  const toPx = (xM: number, yM: number) => ({ x: 12 + xM * PX_PER_M, y: 9 + (6 - yM) * PX_PER_M });

  it('공간 안쪽에 0.5m 간격 격자선을 가로·세로 11개씩 그리고, 1m 선은 굵게 그린다', () => {
    render(<RobotPreview />);
    expect(GRID_STEP_M).toBe(0.5);
    const lines = screen.getByTestId('arena-grid').querySelectorAll('line');
    const xs = [...lines].filter((line) => line.dataset.axis === 'x');
    const ys = [...lines].filter((line) => line.dataset.axis === 'y');
    expect(xs).toHaveLength(11);
    expect(ys).toHaveLength(11);
    for (const line of xs) {
      const m = Number(line.dataset.m);
      expect(Number(line.getAttribute('x1'))).toBeCloseTo(toPx(m, 0).x, 6);
      expect(line.getAttribute('stroke-width')).toBe(Number.isInteger(m) ? '1' : '0.5');
    }
    for (const line of ys) {
      const m = Number(line.dataset.m);
      expect(Number(line.getAttribute('y1'))).toBeCloseTo(toPx(0, m).y, 6);
    }
    expect(screen.getByRole('img', { name: /격자 0.5m/ })).toBeInTheDocument();
  });

  it('출발점은 시뮬레이션 출발 좌표(오른쪽 아래, 벽에서 0.4m)에 그리고, 경로 첫 점과 같다', () => {
    render(<RobotPreview />);
    const start = screen.getByTestId('arena-start');
    const expected = toPx(DEFAULT_ARENA.startXM, DEFAULT_ARENA.startYM);
    expect(Number(start.getAttribute('cx'))).toBeCloseTo(expected.x, 6);
    expect(Number(start.getAttribute('cy'))).toBeCloseTo(expected.y, 6);
    expect(DEFAULT_ARENA).toMatchObject({ startXM: 5.6, startYM: 0.4, marginM: 0.4 });
    const [px, py] = (screen.getByTestId('robot-path').getAttribute('points') ?? '')
      .split(/[ ,]+/)
      .map(Number);
    expect(px).toBeCloseTo(expected.x, 6);
    expect(py).toBeCloseTo(expected.y, 6);
    expect(screen.getByText('출발')).toBeInTheDocument();
  });

  it('대표 경로: 1m 전진은 화면에서 격자 두 칸 위로 간다', () => {
    render(
      <RobotPreview
        path={[
          { xM: 5.6, yM: 0.4 },
          { xM: 5.6, yM: 1.4 },
        ]}
      />,
    );
    const [, y1, , y2] = (screen.getByTestId('robot-path').getAttribute('points') ?? '')
      .split(/[ ,]+/)
      .map(Number);
    // 1m = 0.5m 격자 두 칸
    expect(y1 - y2).toBeCloseTo(2 * GRID_STEP_M * PX_PER_M, 6);
  });

  it('대표 경로(planMotion): 1m 전진 → 왼쪽 90° → 2m 전진은 격자 교차점 (3.6, 1.4) 에서 왼쪽을 본다', () => {
    const plan = planMotion([
      { id: 's', kind: 'start' },
      { id: 'a', kind: 'moveForward', distanceM: 1 },
      { id: 'b', kind: 'rotateLeft', degrees: 90 },
      { id: 'c', kind: 'moveForward', distanceM: 2 },
      { id: 'e', kind: 'end' },
    ]);
    expect(plan.violation).toBeNull();
    const end = plan.path.at(-1)!;
    expect(end.xM).toBeCloseTo(3.6, 6);
    expect(end.yM).toBeCloseTo(1.4, 6);

    render(<RobotPreview path={plan.path} headingDegrees={plan.headingDegrees} />);
    const points = (screen.getByTestId('robot-path').getAttribute('points') ?? '')
      .split(/[ ,]+/)
      .map(Number);
    const expected = toPx(3.6, 1.4);
    expect(points.at(-2)).toBeCloseTo(expected.x, 6);
    expect(points.at(-1)).toBeCloseTo(expected.y, 6);
    // 왼쪽 90° = 270 → SVG 화살표도 시계 방향 270° 회전(화면 왼쪽).
    expect(screen.getByTestId('robot-heading').getAttribute('transform')).toMatch(/rotate\(270\)$/);
  });
});

describe('RobotPreview — 3m × 3m 부스 (Server 설정)', () => {
  const booth = {
    ...DEFAULT_ARENA,
    presetCode: '3x3-부스',
    widthM: 3,
    depthM: 3,
    marginM: 0.5,
    startXM: 2.5,
    startYM: 0.5,
    maxMovePerCommandM: 1.2,
    defaultMoveDistanceM: 0.5,
  };
  // 3 m 를 160 px 에 그린다 → 53.33 px/m, 원점은 왼쪽 아래(12, 9+160)
  const PX = 160 / 3;
  const toPx = (xM: number, yM: number) => ({ x: 12 + xM * PX, y: 9 + (3 - yM) * PX });

  it('안전 구역 문구와 접근성 이름이 3m × 3m 이다', () => {
    render(<RobotPreview arena={booth} />);
    expect(screen.getByText('안전 구역 3m × 3m')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /안전 구역 3m × 3m/ })).toBeInTheDocument();
    expect(screen.queryByText('안전 구역 6m × 6m')).not.toBeInTheDocument();
  });

  it('0.5 m 격자는 안쪽 선이 축마다 5개(0.5~2.5 m)다', () => {
    render(<RobotPreview arena={booth} />);
    const grid = screen.getByTestId('arena-grid');
    const xs = [...grid.querySelectorAll('line[data-axis="x"]')].map((l) =>
      Number(l.getAttribute('data-m')),
    );
    const ys = [...grid.querySelectorAll('line[data-axis="y"]')].map((l) =>
      Number(l.getAttribute('data-m')),
    );
    expect(xs).toEqual([0.5, 1, 1.5, 2, 2.5]);
    expect(ys).toEqual([0.5, 1, 1.5, 2, 2.5]);
    const first = grid.querySelector('line[data-axis="x"]')!;
    expect(Number(first.getAttribute('x1'))).toBeCloseTo(toPx(0.5, 0).x, 6);
  });

  it('출발점은 (2.5, 0.5) 위치에 그리고 경로 첫 점과 같다', () => {
    render(<RobotPreview arena={booth} />);
    const start = screen.getByTestId('arena-start');
    const expected = toPx(2.5, 0.5);
    expect(Number(start.getAttribute('cx'))).toBeCloseTo(expected.x, 6);
    expect(Number(start.getAttribute('cy'))).toBeCloseTo(expected.y, 6);
    const [px, py] = (screen.getByTestId('robot-path').getAttribute('points') ?? '')
      .split(/[ ,]+/)
      .map(Number);
    expect(px).toBeCloseTo(expected.x, 6);
    expect(py).toBeCloseTo(expected.y, 6);
  });

  it('벽 여유 사각형(점선)이 0.5 m 안쪽에 그려진다', () => {
    const { container } = render(<RobotPreview arena={booth} />);
    const rects = container.querySelectorAll('svg rect');
    // 바깥 경계, 벽 여유 안쪽(점선)
    const inner = [...rects].find((r) => r.getAttribute('stroke-dasharray'))!;
    expect(Number(inner.getAttribute('x'))).toBeCloseTo(12 + 0.5 * PX, 6);
    expect(Number(inner.getAttribute('width'))).toBeCloseTo(2 * PX, 6);
    expect(Number(inner.getAttribute('height'))).toBeCloseTo(2 * PX, 6);
  });

  it('네모 걷기 경로를 3×3 공간 위에 그린다(출발점으로 돌아온다)', () => {
    const plan = planMotion(
      [
        { id: 's', kind: 'start' },
        {
          id: 'r',
          kind: 'repeat',
          count: 4,
          body: [
            { id: 'f', kind: 'moveForward', distanceM: 1 },
            { id: 'l', kind: 'rotateLeft', degrees: 90 },
          ],
        },
        { id: 'e', kind: 'end' },
      ],
      booth,
    );
    expect(plan.violation).toBeNull();
    render(<RobotPreview arena={booth} path={plan.path} headingDegrees={plan.headingDegrees} />);
    const points = (screen.getByTestId('robot-path').getAttribute('points') ?? '').split(' ');
    expect(points).toHaveLength(5);
    const [lx, ly] = points[4].split(',').map(Number);
    expect(lx).toBeCloseTo(toPx(2.5, 0.5).x, 6);
    expect(ly).toBeCloseTo(toPx(2.5, 0.5).y, 6);
  });

  it('공간을 안 주면 이전과 같이 6m × 6m 로 그린다', () => {
    render(<RobotPreview />);
    expect(screen.getByText('안전 구역 6m × 6m')).toBeInTheDocument();
  });
});
