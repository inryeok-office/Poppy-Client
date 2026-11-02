// AI 초안 검증 (명세: "원격 응답은 신뢰하지 않는다. 검증을 통과한 블록만 쓴다").
// 로컬 planner 결과도 같은 문을 통과시킨다 — 한 곳에서만 규칙을 지키면 된다.
//
// 규칙:
//   - 허용 종류만: moveForward·move·rotateLeft·rotateRight·wait·stop·standUp·greet·heart·dance·repeat
//     (앉기(sit)는 명시적으로 거부한다 — 명세: "앉기는 만들지 않는다")
//   - 값 범위는 features/simulation 의 LIMITS 를 그대로 재사용한다.
//   - 반복 중첩 금지, 빈 반복 금지.
//   - 구조적으로 최대 12블록(반복은 1 + 몸통, 반복 횟수를 곱하지 않는다).
//   - 모르는 필드는 버린다(여기서 정의한 필드만 뽑아 새 노드를 만든다).

import { LIMITS } from '@/features/simulation';

import type { AiStep } from './types';

export const AI_STEP_MAX_BLOCKS = 12;

const ALLOWED_KINDS = [
  'moveForward',
  'move',
  'rotateLeft',
  'rotateRight',
  'wait',
  'stop',
  'standUp',
  'greet',
  'heart',
  'dance',
  'repeat',
] as const;

const UNRECOGNIZED_REASON = '무슨 블록인지 못 알아들었어요. 다시 말해 볼래요?';
const TOO_MANY_REASON = `한 번에 만들 수 있는 블록은 ${AI_STEP_MAX_BLOCKS}개까지예요. 조금 줄여서 말해 볼래요?`;
const EMPTY_REPEAT_REASON = '반복할 동작이 없어요. 반복 안에 움직임을 넣어서 말해 볼래요?';
const NESTED_REPEAT_REASON = '반복 안에는 반복을 넣을 수 없어요.';
const SIT_REASON = '지금은 앉기 동작을 쓸 수 없어요.';
const VALUE_REASON = '숫자가 범위를 벗어났어요. 다시 말해 볼래요?';

export type ValidateAiStepsResult = { ok: true; steps: AiStep[] } | { ok: false; reason: string };

function inRange(raw: unknown, range: { min: number; max: number; step?: number }): boolean {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < range.min || value > range.max) return false;
  if (range.step === undefined) return Number.isInteger(value);
  return Math.abs(value / range.step - Math.round(value / range.step)) < 1e-9;
}

function countStructural(steps: AiStep[]): number {
  return steps.reduce(
    (sum, step) => sum + 1 + (step.kind === 'repeat' ? countStructural(step.body) : 0),
    0,
  );
}

type OneResult = { ok: true; step: AiStep } | { ok: false; reason: string };

function validateOne(raw: unknown, insideRepeat: boolean): OneResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: UNRECOGNIZED_REASON };
  const node = raw as Record<string, unknown>;
  if (node.kind === 'sit') return { ok: false, reason: SIT_REASON };
  if (typeof node.kind !== 'string' || !ALLOWED_KINDS.includes(node.kind as never)) {
    return { ok: false, reason: UNRECOGNIZED_REASON };
  }

  switch (node.kind) {
    case 'moveForward':
    case 'move':
      if (!inRange(node.distanceM, LIMITS.moveDistance)) return { ok: false, reason: VALUE_REASON };
      return { ok: true, step: { kind: node.kind, distanceM: Number(node.distanceM) } };
    case 'rotateLeft':
    case 'rotateRight':
      if (!inRange(node.degrees, LIMITS.rotateDegree)) return { ok: false, reason: VALUE_REASON };
      return { ok: true, step: { kind: node.kind, degrees: Number(node.degrees) } };
    case 'wait':
      if (!inRange(node.seconds, LIMITS.waitSeconds)) return { ok: false, reason: VALUE_REASON };
      return { ok: true, step: { kind: 'wait', seconds: Number(node.seconds) } };
    case 'stop':
    case 'standUp':
    case 'greet':
    case 'heart':
    case 'dance':
      return { ok: true, step: { kind: node.kind } };
    case 'repeat': {
      if (insideRepeat) return { ok: false, reason: NESTED_REPEAT_REASON };
      if (!inRange(node.count, LIMITS.repeatCount)) return { ok: false, reason: VALUE_REASON };
      if (!Array.isArray(node.body) || node.body.length === 0) {
        return { ok: false, reason: EMPTY_REPEAT_REASON };
      }
      const body: AiStep[] = [];
      for (const child of node.body) {
        const result = validateOne(child, true);
        if (!result.ok) return result;
        if (result.step.kind === 'repeat') return { ok: false, reason: NESTED_REPEAT_REASON };
        body.push(result.step);
      }
      return { ok: true, step: { kind: 'repeat', count: Number(node.count), body } };
    }
    default:
      return { ok: false, reason: UNRECOGNIZED_REASON };
  }
}

export function validateAiSteps(value: unknown): ValidateAiStepsResult {
  if (!Array.isArray(value) || value.length === 0) {
    return { ok: false, reason: UNRECOGNIZED_REASON };
  }
  const steps: AiStep[] = [];
  for (const raw of value) {
    const result = validateOne(raw, false);
    if (!result.ok) return { ok: false, reason: result.reason };
    steps.push(result.step);
  }
  if (countStructural(steps) > AI_STEP_MAX_BLOCKS) {
    return { ok: false, reason: TOO_MANY_REASON };
  }
  return { ok: true, steps };
}
