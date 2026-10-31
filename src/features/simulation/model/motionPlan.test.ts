import { describe, expect, it } from 'vitest';

import { ARENA, countProgramBlocks, describeHeading, planMotion } from './motionPlan';
import { evaluateProgram } from './safety';
import type { SerializedBlockNode } from './types';

const S: SerializedBlockNode = { id: 's', kind: 'start' };
const E: SerializedBlockNode = { id: 'e', kind: 'end' };
const fwd = (distanceM: number): SerializedBlockNode => ({
  id: 'f',
  kind: 'moveForward',
  distanceM,
});
const back = (distanceM: number): SerializedBlockNode => ({ id: 'b', kind: 'move', distanceM });
const right = (degrees: number): SerializedBlockNode => ({ id: 'r', kind: 'rotateRight', degrees });
const left = (degrees: number): SerializedBlockNode => ({ id: 'l', kind: 'rotateLeft', degrees });
const wait = (seconds: number): SerializedBlockNode => ({ id: 'w', kind: 'wait', seconds });
const sit: SerializedBlockNode = { id: 'sit', kind: 'sit' };
const stand: SerializedBlockNode = { id: 'up', kind: 'standUp' };
const greet: SerializedBlockNode = { id: 'g', kind: 'greet' };
const stop: SerializedBlockNode = { id: 'x', kind: 'stop' };
const repeat = (count: number, body: SerializedBlockNode[]): SerializedBlockNode => ({
  id: 'rep',
  kind: 'repeat',
  count,
  body,
});

describe('planMotion — Agent controlled_motion_open 과 같은 계산', () => {
  it('이동 0.5 m/s, 회전 45°/s, 자세 3 s, 특수 동작 5 s, 대기값을 합산한다', () => {
    const plan = planMotion([S, fwd(1), right(90), sit, stand, greet, wait(2), E]);
    expect(plan.totalMeters).toBe(1);
    expect(plan.totalSeconds).toBe(2 + 2 + 3 + 3 + 5 + 2);
    expect(plan.finalPosture).toBe('standing');
    expect(plan.violation).toBeNull();
  });

  it('반복은 횟수만큼 펼쳐 더하고, 누적 회전으로 방향을 계산한다', () => {
    const plan = planMotion([S, repeat(4, [fwd(0.5), right(90)]), E]);
    expect(plan.totalMeters).toBe(2);
    expect(plan.totalSeconds).toBe(4 * (1 + 2));
    expect(plan.headingDegrees).toBe(0);
    expect(planMotion([S, right(90), E]).headingDegrees).toBe(90);
    expect(planMotion([S, left(90), E]).headingDegrees).toBe(270);
  });

  it('정지 뒤 블록은 실행되지 않는다', () => {
    const plan = planMotion([S, fwd(1), stop, fwd(3), E]);
    expect(plan.totalMeters).toBe(1);
    expect(plan.steps.map((s) => s.node.kind)).toEqual(['start', 'moveForward', 'stop', 'end']);
  });

  it('앉은 뒤 일어서기 전 이동·회전·특수 동작은 규칙 위반', () => {
    expect(planMotion([S, sit, fwd(0.5), E]).violation).toEqual({
      index: 2,
      code: 'moves-while-sitting',
    });
    expect(planMotion([S, sit, right(90), E]).violation?.code).toBe('moves-while-sitting');
    expect(planMotion([S, sit, greet, E]).violation?.code).toBe('moves-while-sitting');
    expect(planMotion([S, sit, wait(1), stand, fwd(0.5), E]).violation).toBeNull();
    expect(planMotion([S, sit, E]).finalPosture).toBe('sitting');
  });

  it('총 시간 120 s 초과는 처음 넘은 단계에서 위반', () => {
    expect(planMotion([S, repeat(10, [wait(10)]), repeat(2, [wait(10)]), E]).violation).toBeNull();
    expect(planMotion([S, repeat(10, [wait(10)]), repeat(3, [wait(10)]), E]).violation?.code).toBe(
      'exceeds-time',
    );
  });
});

describe('planMotion — 4m × 4m 공간 위치 검사 (Agent OpenMotionGuard 와 같은 규칙)', () => {
  const end = (...body: SerializedBlockNode[]) => planMotion([S, ...body, E]);
  const finalPoint = (plan: ReturnType<typeof planMotion>) => plan.path[plan.path.length - 1];

  it('출발 위치는 아래쪽 변 가운데, 벽 여유 0.4 m 를 뺀 영역 안이다', () => {
    expect(ARENA).toEqual({ widthM: 4, depthM: 4, marginM: 0.4, startXM: 2, startYM: 0.4 });
    expect(end().path).toEqual([{ xM: 2, yM: 0.4 }]);
  });

  it('스크린샷 사례: 0.6 m 4회 → 왼쪽 90° → 0.6 m 5회는 왼쪽 벽 여유에서 실패한다', () => {
    const plan = end(repeat(4, [fwd(0.6)]), left(90), repeat(5, [fwd(0.6)]));
    expect(plan.violation).toEqual({ index: 8, code: 'exceeds-safe-zone' });
    expect(plan.steps[8]?.cumulativeMeters).toBeCloseTo(4.2);
    expect(plan.failurePoint?.xM).toBeCloseTo(0.4);
    expect(plan.failurePoint?.yM).toBeCloseTo(2.8);
    expect(end(repeat(4, [fwd(0.6)]), left(90), repeat(2, [fwd(0.6)])).violation).toBeNull();
  });

  it.each([
    ['위쪽', [fwd(3), fwd(0.2)], [fwd(3), fwd(0.3)]],
    ['오른쪽', [right(90), fwd(1.6)], [right(90), fwd(1.7)]],
    ['왼쪽', [left(90), fwd(1.6)], [left(90), fwd(1.7)]],
    ['아래쪽', [fwd(1), back(1)], [fwd(1), back(1.1)]],
  ])('%s 벽 여유 경계: 정확히 닿으면 통과, 0.1 m 넘으면 실패', (_wall, inside, outside) => {
    expect(end(...inside).violation).toBeNull();
    expect(end(...outside).violation?.code).toBe('exceeds-safe-zone');
  });

  it('왼쪽은 반시계, 오른쪽은 시계 방향이다', () => {
    expect(finalPoint(end(right(90), fwd(1))).xM).toBeCloseTo(3);
    expect(finalPoint(end(left(90), fwd(1))).xM).toBeCloseTo(1);
    expect(finalPoint(end(fwd(1), right(180), fwd(0.5))).yM).toBeCloseTo(0.9);
    expect(finalPoint(end(right(30), fwd(1))).xM).toBeCloseTo(2.5);
    expect(finalPoint(end(right(30), fwd(1))).yM).toBeCloseTo(0.4 + Math.sqrt(3) / 2);
  });

  it('뒤로 이동은 바라보는 반대 방향이고, 출발 직후 뒤로 가면 벽 여유를 벗어난다', () => {
    expect(end(back(0.1)).violation?.index).toBe(1);
    expect(finalPoint(end(right(180), back(1))).yM).toBeCloseTo(1.4);
  });

  it('제자리 회전·자세·특수 동작·대기는 위치를 바꾸지 않는다', () => {
    expect(end(right(90), left(45), sit, wait(1), stand, greet).path).toEqual([{ xM: 2, yM: 0.4 }]);
  });

  it('총 이동이 4 m 를 넘어도 공간 안이면 통과한다', () => {
    const plan = end(repeat(3, [fwd(1.5), back(1.5)]));
    expect(plan.totalMeters).toBe(9);
    expect(plan.violation).toBeNull();
  });

  it('경로는 처음 벗어난 지점에서 끝나고, 뒤에 공간으로 돌아오는 블록이 있어도 실패다', () => {
    const plan = end(fwd(3), fwd(1), back(3));
    expect(plan.violation?.index).toBe(2);
    expect(plan.path).toHaveLength(3);
    expect(finalPoint(plan).yM).toBeCloseTo(3.6);
  });
});

describe('evaluateProgram — 실행 규칙을 모두 통과해야 runnable', () => {
  const evaluate = (...body: SerializedBlockNode[]) =>
    evaluateProgram({ chain: [S, ...body, E], detached: [] });

  it('규칙 위반 종류를 알려준다', () => {
    expect(evaluate(sit, fwd(0.5))).toMatchObject({
      runnable: false,
      violation: 'moves-while-sitting',
    });
    expect(evaluate(repeat(10, [wait(10)]), repeat(3, [wait(10)]))).toMatchObject({
      runnable: false,
      violation: 'exceeds-time',
    });
    expect(evaluate(fwd(1))).toMatchObject({ runnable: true, violation: null, totalSeconds: 2 });
  });
});

describe('표시 도우미', () => {
  it('구조적 블록 수는 시작·종료를 빼고 반복은 한 번만 센다', () => {
    expect(countProgramBlocks([S, repeat(4, [fwd(0.5), right(90)]), wait(1), E])).toBe(4);
  });

  it('누적 회전을 방향 문구로 바꾼다', () => {
    expect(describeHeading(0)).toBe('정면');
    expect(describeHeading(90)).toBe('오른쪽 90°');
    expect(describeHeading(180)).toBe('뒤쪽');
    expect(describeHeading(270)).toBe('왼쪽 90°');
    expect(describeHeading(-30)).toBe('왼쪽 30°');
  });
});
