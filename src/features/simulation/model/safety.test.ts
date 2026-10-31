import { describe, expect, it } from 'vitest';

import { evaluateProgram, LIMITS } from './safety';
import type { SerializedBlockNode } from './types';

const evaluate = (...body: SerializedBlockNode[]) =>
  evaluateProgram({
    chain: [{ id: 's', kind: 'start' }, ...body, { id: 'e', kind: 'end' }],
    detached: [],
  });

describe('LIMITS — controlled_motion_open 시험 기준', () => {
  it('이동 0.1~3.0 m(0.1 단위), 회전 1~360°, 대기 1~10 s, 반복 1~10회다', () => {
    expect(LIMITS).toEqual({
      repeatCount: { min: 1, max: 10 },
      moveDistance: { min: 0.1, max: 3, step: 0.1 },
      waitSeconds: { min: 1, max: 10 },
      rotateDegree: { min: 1, max: 360 },
    });
  });

  it('0.1 단위 소수 이동 거리는 허용하고 그 밖은 거부한다', () => {
    expect(evaluate({ id: 'm', kind: 'moveForward', distanceM: 0.3 }).valuesValid).toBe(true);
    expect(evaluate({ id: 'm', kind: 'moveForward', distanceM: 3 }).valuesValid).toBe(true);
    expect(evaluate({ id: 'm', kind: 'moveForward', distanceM: 0.25 }).valuesValid).toBe(false);
    expect(evaluate({ id: 'm', kind: 'moveForward', distanceM: 3.1 }).valuesValid).toBe(false);
    expect(evaluate({ id: 'm', kind: 'moveForward', distanceM: 0 }).valuesValid).toBe(false);
  });

  it('회전·대기·반복은 정수 범위만 허용한다', () => {
    expect(evaluate({ id: 't', kind: 'rotateRight', degrees: 360 }).valuesValid).toBe(true);
    expect(evaluate({ id: 't', kind: 'rotateRight', degrees: 361 }).valuesValid).toBe(false);
    expect(evaluate({ id: 't', kind: 'rotateRight', degrees: 1.5 }).valuesValid).toBe(false);
    expect(evaluate({ id: 'w', kind: 'wait', seconds: 11 }).valuesValid).toBe(false);
    expect(evaluate({ id: 'r', kind: 'repeat', count: 11, body: [] }).valuesValid).toBe(false);
  });

  it('반복은 펼쳐서 위치로 계산한다', () => {
    const patrol = (count: number): SerializedBlockNode => ({
      id: 'r',
      kind: 'repeat',
      count,
      body: [
        { id: 'm', kind: 'moveForward', distanceM: 0.5 },
        { id: 't', kind: 'rotateRight', degrees: 90 },
      ],
    });
    expect(evaluate(patrol(9)).runnable).toBe(false); // 오른쪽으로 먼저 돌면 벽 여유 밖
    const straight: SerializedBlockNode = {
      id: 'r',
      kind: 'repeat',
      count: 8,
      body: [{ id: 'm', kind: 'moveForward', distanceM: 1 }],
    };
    expect(evaluate(straight)).toMatchObject({
      runnable: false,
      violation: 'exceeds-safe-zone',
      violationIndex: 6,
    });
  });
});
