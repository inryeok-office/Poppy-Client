import { SAFE_ZONE_M } from './safety';
import type { SerializedBlockNode } from './types';

// 블록 프로그램을 실제 실행 순서대로 펼쳐 이동 거리·동작 시간·자세·방향을 계산한다.
// 수치는 Agent controlled_motion_open(실행 1회 기준)과 같다 — 시뮬레이션 판정과 로봇 미리보기가
// 실제 로봇이 거부할 프로그램을 통과시키지 않게 한 곳에서 정한다.

export const MOTION_TIMING = {
  /** MOVE 선속도 (m/s) */
  linearMetersPerSecond: 0.5,
  /** TURN 각속도 (°/s) */
  turnDegreesPerSecond: 45,
  /** 앉기·일어서기 후 고정 대기 (s) */
  postureSettleSeconds: 3,
  /** 특수 동작(인사·하트·춤) 후 고정 대기 (s) */
  presetSettleSeconds: 5,
} as const;

/** 실행 1회 총 동작 시간 상한 (s) — Agent 와 같다. */
export const MAX_TOTAL_SECONDS = 120;

export type MotionViolationCode = 'exceeds-safe-zone' | 'exceeds-time' | 'moves-while-sitting';
export type Posture = 'standing' | 'sitting';

export type PlannedStep = {
  node: SerializedBlockNode;
  /** 이 블록까지의 누적 이동 거리 (m) */
  cumulativeMeters: number;
  /** 이 블록까지의 누적 동작 시간 (s) */
  cumulativeSeconds: number;
};

export type MotionPlan = {
  /** 실제로 실행되는 순서 (반복은 횟수만큼 펼침, '정지' 뒤 블록은 빠지고 종료만 남음) */
  steps: PlannedStep[];
  totalMeters: number;
  totalSeconds: number;
  finalPosture: Posture;
  /** 누적 회전 (오른쪽 +, 0~359°) */
  headingDegrees: number;
  /** 처음 규칙을 어긴 단계 (없으면 null) */
  violation: { index: number; code: MotionViolationCode } | null;
};

const PRESET_KINDS = new Set<SerializedBlockNode['kind']>(['greet', 'heart', 'dance']);

function flatten(nodes: SerializedBlockNode[]): SerializedBlockNode[] {
  const out: SerializedBlockNode[] = [];
  for (const node of nodes) {
    if (node.kind === 'repeat') {
      for (let i = 0; i < node.count; i += 1) out.push(...flatten(node.body));
    } else {
      out.push(node);
    }
  }
  return out;
}

/** 블록 하나가 더하는 이동 거리·시간. */
function costOf(node: SerializedBlockNode): { meters: number; seconds: number } {
  switch (node.kind) {
    case 'move':
    case 'moveForward':
      return {
        meters: node.distanceM,
        seconds: node.distanceM / MOTION_TIMING.linearMetersPerSecond,
      };
    case 'rotateLeft':
    case 'rotateRight':
      return { meters: 0, seconds: node.degrees / MOTION_TIMING.turnDegreesPerSecond };
    case 'sit':
    case 'standUp':
      return { meters: 0, seconds: MOTION_TIMING.postureSettleSeconds };
    case 'wait':
      return { meters: 0, seconds: node.seconds };
    default:
      return {
        meters: 0,
        seconds: PRESET_KINDS.has(node.kind) ? MOTION_TIMING.presetSettleSeconds : 0,
      };
  }
}

const needsStanding = (node: SerializedBlockNode) =>
  node.kind === 'move' ||
  node.kind === 'moveForward' ||
  node.kind === 'rotateLeft' ||
  node.kind === 'rotateRight' ||
  PRESET_KINDS.has(node.kind);

export function planMotion(chain: SerializedBlockNode[]): MotionPlan {
  const flat = flatten(chain);
  const stopAt = flat.findIndex((node) => node.kind === 'stop');
  // '정지'는 프로그램을 끝낸다 — 그 뒤 블록은 실행되지 않는다(종료 블록만 표시용으로 남긴다).
  const executed =
    stopAt === -1
      ? flat
      : [...flat.slice(0, stopAt + 1), ...flat.slice(stopAt + 1).filter((n) => n.kind === 'end')];

  let meters = 0;
  let seconds = 0;
  let posture: Posture = 'standing';
  let heading = 0;
  let violation: MotionPlan['violation'] = null;
  const steps = executed.map((node, index) => {
    const cost = costOf(node);
    if (violation === null && posture === 'sitting' && needsStanding(node)) {
      violation = { index, code: 'moves-while-sitting' };
    }
    meters += cost.meters;
    seconds += cost.seconds;
    if (node.kind === 'sit') posture = 'sitting';
    if (node.kind === 'standUp') posture = 'standing';
    if (node.kind === 'rotateRight') heading += node.degrees;
    if (node.kind === 'rotateLeft') heading -= node.degrees;
    if (violation === null && meters > SAFE_ZONE_M + 1e-9) {
      violation = { index, code: 'exceeds-safe-zone' };
    }
    if (violation === null && seconds > MAX_TOTAL_SECONDS + 1e-9) {
      violation = { index, code: 'exceeds-time' };
    }
    return { node, cumulativeMeters: meters, cumulativeSeconds: seconds };
  });

  return {
    steps,
    totalMeters: meters,
    totalSeconds: seconds,
    finalPosture: posture,
    headingDegrees: ((Math.round(heading) % 360) + 360) % 360,
    violation,
  };
}

/** 시작·종료를 뺀 구조적 블록 수 (반복은 한 번만 센다). */
export function countProgramBlocks(nodes: SerializedBlockNode[]): number {
  return nodes.reduce(
    (sum, node) =>
      node.kind === 'start' || node.kind === 'end'
        ? sum
        : sum + 1 + (node.kind === 'repeat' ? countProgramBlocks(node.body) : 0),
    0,
  );
}

/** 누적 회전을 사람이 읽는 방향으로 (0 → 정면, 180 → 뒤쪽). */
export function describeHeading(degrees: number): string {
  const h = ((Math.round(degrees) % 360) + 360) % 360;
  if (h === 0) return '정면';
  if (h === 180) return '뒤쪽';
  return h < 180 ? `오른쪽 ${h}°` : `왼쪽 ${360 - h}°`;
}
