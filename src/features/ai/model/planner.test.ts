import { describe, expect, it } from 'vitest';

import { planFromUtterance } from './planner';
import { validateAiSteps } from './validate';

describe('planFromUtterance', () => {
  it('네모 → 4번 반복 {앞으로 1m, 왼쪽 90도}', () => {
    const result = planFromUtterance('네모를 그리면서 걸어 줘');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([
      {
        kind: 'repeat',
        count: 4,
        body: [
          { kind: 'moveForward', distanceM: 1 },
          { kind: 'rotateLeft', degrees: 90 },
        ],
      },
    ]);
    expect(validateAiSteps(result.draft.steps).ok).toBe(true);
  });

  it('한 바퀴 → 4번 반복 {오른쪽 90도}', () => {
    const result = planFromUtterance('로봇아 한 바퀴 돌아줘');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([
      { kind: 'repeat', count: 4, body: [{ kind: 'rotateRight', degrees: 90 }] },
    ]);
  });

  it('반 바퀴 → 180도 회전 (반복으로 감싸지 않음)', () => {
    const result = planFromUtterance('반 바퀴 돌아');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([{ kind: 'rotateRight', degrees: 180 }]);
  });

  it('cm·도 단위를 읽는다', () => {
    const result = planFromUtterance('앞으로 100cm 가고 오른쪽으로 45도 돌아');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([
      { kind: 'moveForward', distanceM: 1 },
      { kind: 'rotateRight', degrees: 45 },
    ]);
  });

  it('칸 단위는 0.5m 로 읽는다', () => {
    const result = planFromUtterance('앞으로 2칸 가');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([{ kind: 'moveForward', distanceM: 1 }]);
  });

  it('"0.5m 가고 하트 세 번" → 소수점에서 조각을 나누지 않고, "세 번"은 하트만 감싼다', () => {
    const result = planFromUtterance('0.5m 가고 하트 세 번');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([
      { kind: 'moveForward', distanceM: 0.5 },
      { kind: 'repeat', count: 3, body: [{ kind: 'heart' }] },
    ]);
  });

  it('범위를 넘는 값은 범위 안으로 맞추고 설명에 이유를 남긴다', () => {
    const result = planFromUtterance('앞으로 10m 가');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.draft.steps).toEqual([{ kind: 'moveForward', distanceM: 3 }]);
    expect(result.draft.explanation).toContain('3m');
  });

  it('앉기 요청은 블록을 만들지 않고 안내로만 거부한다', () => {
    const result = planFromUtterance('앉아');
    expect(result.ok).toBe(false);
  });

  it('못 알아들으면 안내 문구를 돌려준다', () => {
    const result = planFromUtterance('asdf qwer 1234 ㅁㄴㅇㄹ');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('말해 볼래요');
  });

  it('planner 가 만든 모든 draft 는 validateAiSteps 를 통과한다', () => {
    const utterances = [
      '네모를 그리면서 걸어 줘',
      '세모를 그려줘',
      '한 바퀴 돌아',
      '반 바퀴 돌아',
      '인사하고 하트 세 번',
      '5초 기다렸다가 춤춰줘',
    ];
    for (const utterance of utterances) {
      const result = planFromUtterance(utterance);
      expect(result.ok).toBe(true);
      if (result.ok) expect(validateAiSteps(result.draft.steps).ok).toBe(true);
    }
  });
});
