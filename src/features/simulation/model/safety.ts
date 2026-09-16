import { sumOverBlockTree } from '@/shared/lib/blockTree';

import type { SerializedBlockNode, SerializedBlockProgram } from './types';

// 서버 측 안전 정책 (명세: "서버 정책이 클라이언트보다 우선한다").
// 시뮬레이션 mock 과 실행 mock 이 같은 판정을 쓴다. views/experience 의 입력칸 min·max 도
// 이 값을 그대로 가져다 쓴다(LIMITS export) — 클라이언트·서버가 서로 다른 범위를 들고 있다가
// 어긋나는 걸 막는다.
export const SAFE_ZONE_M = 2;

export const LIMITS = {
  repeatCount: { min: 1, max: 20 },
  moveDistance: { min: 1, max: 10 },
  waitSeconds: { min: 1, max: 60 },
} as const;

const inRange = (raw: unknown, { min, max }: { min: number; max: number }) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max;
};

function isValueValid(node: SerializedBlockNode): boolean {
  switch (node.kind) {
    case 'move':
      return inRange(node.distanceM, LIMITS.moveDistance);
    case 'wait':
      return inRange(node.seconds, LIMITS.waitSeconds);
    case 'repeat':
      return inRange(node.count, LIMITS.repeatCount);
    default:
      return true;
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
    valueOf: (node) => (node.kind === 'move' ? node.distanceM : 0),
    bodyOf,
    repeatCountOf: (node) => (node.kind === 'repeat' ? node.count : 1),
  });
}

export type ProgramEvaluation = {
  structurallyValid: boolean;
  valuesValid: boolean;
  totalDistanceM: number;
  withinSafeZone: boolean;
  /** 시뮬레이션·실제 실행을 모두 진행할 수 있는 상태인지 */
  runnable: boolean;
};

export function evaluateProgram(program: SerializedBlockProgram): ProgramEvaluation {
  const valuesValid = allValuesValid(program.chain) && allValuesValid(program.detached);
  const totalDistanceM = valuesValid ? totalDistance(program.chain) : 0;
  const structurallyValid = program.detached.length === 0 && program.chain.at(-1)?.kind === 'end';
  const withinSafeZone = valuesValid && totalDistanceM <= SAFE_ZONE_M;

  return {
    structurallyValid,
    valuesValid,
    totalDistanceM,
    withinSafeZone,
    runnable: structurallyValid && valuesValid && withinSafeZone,
  };
}
