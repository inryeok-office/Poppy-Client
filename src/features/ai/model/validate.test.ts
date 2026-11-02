import { describe, expect, it } from 'vitest';

import { AI_STEP_MAX_BLOCKS, validateAiSteps } from './validate';

describe('validateAiSteps', () => {
  it('허용 종류·범위 안 값을 그대로 통과시킨다', () => {
    const result = validateAiSteps([
      { kind: 'moveForward', distanceM: 1 },
      { kind: 'rotateLeft', degrees: 90 },
      { kind: 'repeat', count: 3, body: [{ kind: 'heart' }] },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.steps).toHaveLength(3);
  });

  it('모르는 필드는 버리고 알려진 필드만 남긴다', () => {
    const result = validateAiSteps([
      { kind: 'moveForward', distanceM: 1, id: 'should-be-dropped', extra: true },
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.steps[0]).toEqual({ kind: 'moveForward', distanceM: 1 });
  });

  it('앉기(sit)는 명시적으로 거부한다', () => {
    const result = validateAiSteps([{ kind: 'sit' }]);
    expect(result.ok).toBe(false);
  });

  it('알 수 없는 kind 는 거부한다', () => {
    const result = validateAiSteps([{ kind: 'flyAway' }]);
    expect(result.ok).toBe(false);
  });

  it('값이 LIMITS 범위를 벗어나면 거부한다', () => {
    const tooFar = validateAiSteps([{ kind: 'moveForward', distanceM: 10 }]);
    expect(tooFar.ok).toBe(false);
    const badDegrees = validateAiSteps([{ kind: 'rotateLeft', degrees: 400 }]);
    expect(badDegrees.ok).toBe(false);
  });

  it('반복 중첩을 거부한다', () => {
    const result = validateAiSteps([
      { kind: 'repeat', count: 2, body: [{ kind: 'repeat', count: 2, body: [{ kind: 'heart' }] }] },
    ]);
    expect(result.ok).toBe(false);
  });

  it('빈 반복을 거부한다', () => {
    const result = validateAiSteps([{ kind: 'repeat', count: 3, body: [] }]);
    expect(result.ok).toBe(false);
  });

  it(`구조적으로 ${AI_STEP_MAX_BLOCKS}블록을 넘으면 거부한다`, () => {
    const many = Array.from({ length: AI_STEP_MAX_BLOCKS + 1 }, () => ({ kind: 'greet' }));
    const result = validateAiSteps(many);
    expect(result.ok).toBe(false);
  });

  it('반복 횟수를 곱하지 않고 구조적으로만 센다(최대치 안쪽은 통과)', () => {
    // repeat(1) + body 2개 = 구조적으로 3개로 센다. count 값 자체는 반복 실행 횟수일 뿐.
    const result = validateAiSteps([
      {
        kind: 'repeat',
        count: 10,
        body: [{ kind: 'moveForward', distanceM: 1 }, { kind: 'heart' }],
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it('빈 배열·배열이 아닌 값은 거부한다', () => {
    expect(validateAiSteps([]).ok).toBe(false);
    expect(validateAiSteps('not-an-array').ok).toBe(false);
    expect(validateAiSteps(null).ok).toBe(false);
  });
});
