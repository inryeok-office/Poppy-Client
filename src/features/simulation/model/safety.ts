import { sumOverBlockTree } from '@/shared/lib/blockTree';

import { planMotion, type MotionViolationCode } from './motionPlan';
import type { SerializedBlockNode, SerializedBlockProgram, SimulationStep } from './types';

// 서버 측 안전 정책 (명세: "서버 정책이 클라이언트보다 우선한다").
// 시뮬레이션 mock 과 실행 mock 이 같은 판정을 쓴다. views/experience 의 입력칸 min·max 도
// 이 값을 그대로 가져다 쓴다(LIMITS export) — 클라이언트·서버가 서로 다른 범위를 들고 있다가
// 어긋나는 걸 막는다.
// 실행 1회 총 이동 거리 상한 — Agent controlled_motion_open 의 4.0 m 와 같다.
export const SAFE_ZONE_M = 4;

// step 이 있으면 그 단위의 소수, 없으면 정수만 허용한다.
export const LIMITS = {
  repeatCount: { min: 1, max: 10 },
  moveDistance: { min: 0.1, max: 3, step: 0.1 },
  waitSeconds: { min: 1, max: 10 },
  rotateDegree: { min: 1, max: 360 },
} as const;

const inRange = (raw: unknown, { min, max, step }: { min: number; max: number; step?: number }) => {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) return false;
  if (step === undefined) return Number.isInteger(value);
  return Math.abs(value / step - Math.round(value / step)) < 1e-9;
};

/** 값 블록 종류별 허용 범위 표기 (입력칸 포커스 툴팁)·오류 문구. */
export const VALUE_RANGE_TEXT = {
  move: { hint: '0.1~3 m (0.1 단위)', error: '0.1~3 m 사이로 입력해 주세요' },
  rotate: { hint: '1~360°', error: '1~360° 사이로 입력해 주세요' },
  wait: { hint: '1~10초', error: '1~10초 사이로 입력해 주세요' },
  repeat: { hint: '1~10번', error: '1~10번 사이로 입력해 주세요' },
} as const;

type ValueKind = keyof typeof VALUE_RANGE_TEXT;

/** 값 입력이 있는 블록이면 그 범위 표기 종류, 아니면 null. */
export function valueKindOf(kind: SerializedBlockNode['kind']): ValueKind | null {
  switch (kind) {
    case 'move':
    case 'moveForward':
      return 'move';
    case 'rotateLeft':
    case 'rotateRight':
      return 'rotate';
    case 'wait':
      return 'wait';
    case 'repeat':
      return 'repeat';
    default:
      return null;
  }
}

/** 블록 하나의 값이 허용 범위 안인지 (값 없는 블록은 true). */
export function isBlockValueValid(node: SerializedBlockNode): boolean {
  return isValueValid(node);
}

function isValueValid(node: SerializedBlockNode): boolean {
  switch (node.kind) {
    case 'move':
    case 'moveForward':
      return inRange(node.distanceM, LIMITS.moveDistance);
    case 'wait':
      return inRange(node.seconds, LIMITS.waitSeconds);
    case 'repeat':
      return inRange(node.count, LIMITS.repeatCount);
    case 'rotateLeft':
    case 'rotateRight':
      return inRange(node.degrees, LIMITS.rotateDegree);
    case 'start':
    case 'greet':
    case 'end':
    case 'stop':
    case 'sit':
    case 'standUp':
    case 'heart':
    case 'dance':
    case 'roll':
    case 'attack':
      return true; // 파라미터가 없는 블록 — 값 검증 대상이 아니다
    default:
      // 알 수 없는(지원 종료됐거나 조작된) kind — 값 검증을 우회하지 못하게 명시적으로 거부한다.
      return false;
  }
}

const bodyOf = (node: SerializedBlockNode) => (node.kind === 'repeat' ? node.body : undefined);

/** 블록별 값(반복 횟수·이동 거리·대기 시간)이 트리 어디서든 허용 범위 안인지. */
function allValuesValid(nodes: SerializedBlockNode[]): boolean {
  const invalidCount = sumOverBlockTree(nodes, {
    valueOf: (node) => (isValueValid(node) ? 0 : 1),
    bodyOf,
    repeatCountOf: () => 1, // 구조적으로만 훑는다 — 반복 횟수를 곱해 개수를 부풀리지 않는다
  });
  return invalidCount === 0;
}

/** 반복 중첩까지 포함한 총 이동 거리 (명세: "제한을 우회하는 중첩·합산 값도 계산"). */
function totalDistance(nodes: SerializedBlockNode[]): number {
  return sumOverBlockTree(nodes, {
    valueOf: (node) => (node.kind === 'move' || node.kind === 'moveForward' ? node.distanceM : 0),
    bodyOf,
    repeatCountOf: (node) => (node.kind === 'repeat' ? node.count : 1),
  });
}

/**
 * 실행 순서(Figma Slide 6·7)를 만들고, 처음 규칙을 어긴 지점(총 이동 SAFE_ZONE_M 초과·총 시간
 * 초과·앉은 상태 이동)을 실패, 그 앞은 완료, 그 뒤는 대기로 표시한다. 구조·값이 유효할 때만
 * 호출한다(evaluateProgram 참고).
 */
export function buildSimulationSteps(chain: SerializedBlockNode[]): SimulationStep[] {
  const plan = planMotion(chain);
  const failedAt = plan.violation?.index ?? -1;
  return plan.steps.map(({ node }, index) => ({
    node,
    status:
      failedAt === -1 || index < failedAt ? 'done' : index === failedAt ? 'failed' : 'pending',
  }));
}

export type ProgramEvaluation = {
  structurallyValid: boolean;
  valuesValid: boolean;
  totalDistanceM: number;
  /** 예상 총 동작 시간 (s) */
  totalSeconds: number;
  withinSafeZone: boolean;
  /** 처음 어긴 실행 규칙 (값이 유효할 때만 계산) */
  violation: MotionViolationCode | null;
  /** 시뮬레이션·실제 실행을 모두 진행할 수 있는 상태인지 */
  runnable: boolean;
};

export function evaluateProgram(program: SerializedBlockProgram): ProgramEvaluation {
  const valuesValid = allValuesValid(program.chain) && allValuesValid(program.detached);
  const plan = valuesValid ? planMotion(program.chain) : null;
  const totalDistanceM = valuesValid ? totalDistance(program.chain) : 0;
  const structurallyValid = program.detached.length === 0 && program.chain.at(-1)?.kind === 'end';
  const violation = plan?.violation?.code ?? null;
  const withinSafeZone = valuesValid && violation !== 'exceeds-safe-zone';

  return {
    structurallyValid,
    valuesValid,
    totalDistanceM,
    totalSeconds: plan?.totalSeconds ?? 0,
    withinSafeZone,
    violation,
    runnable: structurallyValid && valuesValid && violation === null,
  };
}
