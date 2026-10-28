import { describe, expect, it } from 'vitest';

import { countProgramBlocks, describeHeading, planMotion } from './motionPlan';
import { evaluateProgram } from './safety';
import type { SerializedBlockNode } from './types';

const S: SerializedBlockNode = { id: 's', kind: 'start' };
const E: SerializedBlockNode = { id: 'e', kind: 'end' };
const fwd = (distanceM: number): SerializedBlockNode => ({
  id: 'f',
  kind: 'moveForward',
  distanceM,
});
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

  it('총 이동 4 m 초과·총 시간 120 s 초과는 처음 넘은 단계에서 위반', () => {
    expect(planMotion([S, repeat(8, [fwd(0.5)]), E]).violation).toBeNull();
    expect(planMotion([S, repeat(9, [fwd(0.5)]), E]).violation).toEqual({
      index: 9,
      code: 'exceeds-safe-zone',
    });
    expect(planMotion([S, repeat(10, [wait(10)]), repeat(2, [wait(10)]), E]).violation).toBeNull();
    expect(planMotion([S, repeat(10, [wait(10)]), repeat(3, [wait(10)]), E]).violation?.code).toBe(
      'exceeds-time',
    );
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
