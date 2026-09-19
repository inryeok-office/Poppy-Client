import { sumOverBlockTree } from '@/shared/lib/blockTree';

import type { SerializedBlockNode, SerializedBlockProgram, SimulationStep } from './types';

// 서버 측 안전 정책 (명세: "서버 정책이 클라이언트보다 우선한다").
// 시뮬레이션 mock 과 실행 mock 이 같은 판정을 쓴다. views/experience 의 입력칸 min·max 도
// 이 값을 그대로 가져다 쓴다(LIMITS export) — 클라이언트·서버가 서로 다른 범위를 들고 있다가
// 어긋나는 걸 막는다.
export const SAFE_ZONE_M = 2;

export const LIMITS = {
  repeatCount: { min: 1, max: 20 },
  moveDistance: { min: 1, max: 10 },
  waitSeconds: { min: 1, max: 60 },
  rotateDegree: { min: 1, max: 360 },
} as const;

const inRange = (raw: unknown, { min, max }: { min: number; max: number }) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max;
};

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

function flattenSteps(nodes: SerializedBlockNode[]): SerializedBlockNode[] {
  const out: SerializedBlockNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'repeat') {
      for (let i = 0; i < node.count; i++) out.push(...flattenSteps(node.body));
    } else {
      out.push(node);
    }
  }
  return out;
}

/**
 * 정규화된 명령을 실제 반복 횟수만큼 펼쳐 실행순서를 만들고(Figma Slide 6·7), 누적 이동
 * 거리가 처음 안전 구역(SAFE_ZONE_M)을 넘는 지점을 찾아 그 앞은 완료, 그 지점은 실패,
 * 그 뒤는 대기로 표시한다. 구조·값이 유효할 때만 호출한다(evaluateProgram 참고).
 */
export function buildSimulationSteps(chain: SerializedBlockNode[]): SimulationStep[] {
  const flat = flattenSteps(chain);
  let cumulative = 0;
  let failedAt = -1;

  return flat.map((node, index) => {
    if (failedAt === -1) {
      cumulative += node.kind === 'move' || node.kind === 'moveForward' ? node.distanceM : 0;
      if (cumulative > SAFE_ZONE_M) failedAt = index;
    }
    const status =
      failedAt === -1 || index < failedAt ? 'done' : index === failedAt ? 'failed' : 'pending';
    return { node, status };
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
