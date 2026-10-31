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

/**
 * 체험 공간과 출발 자세 — Agent 의 POPPY_PHYSICAL_ARENA_* · POPPY_PHYSICAL_START_* 와 같은 값이다.
 * 좌표는 m, 원점은 왼쪽 아래 모서리, 출발 시 +y 방향을 본다.
 */
export const ARENA = { widthM: 6, depthM: 6, marginM: 0.4, startXM: 5.6, startYM: 0.4 } as const;

/** 실행 1회 총 동작 시간 상한 (s) — Agent 와 같다. */
export const MAX_TOTAL_SECONDS = 120;

export type MotionViolationCode = 'exceeds-safe-zone' | 'exceeds-time' | 'moves-while-sitting';
export type Posture = 'standing' | 'sitting';

export type ArenaPoint = { xM: number; yM: number };

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
  /** 출발점부터 이동 구간 끝점들. 벽 여유를 처음 벗어나면 그 지점에서 끝난다 */
  path: ArenaPoint[];
  /** 안전 구역을 벗어난 지점 (없으면 null) */
  failurePoint: ArenaPoint | null;
  /** 처음 규칙을 어긴 단계 (없으면 null) */
  violation: { index: number; code: MotionViolationCode } | null;
};

const EDGE_EPSILON = 1e-9;

function insideArena({ xM, yM }: ArenaPoint): boolean {
  const { widthM, depthM, marginM } = ARENA;
  return (
    xM >= marginM - EDGE_EPSILON &&
    xM <= widthM - marginM + EDGE_EPSILON &&
    yM >= marginM - EDGE_EPSILON &&
    yM <= depthM - marginM + EDGE_EPSILON
  );
}

/** 영역 안 from 에서 영역 밖 to 로 가는 구간이 허용 영역 경계를 처음 넘는 지점. */
function exitPoint(from: ArenaPoint, to: ArenaPoint): ArenaPoint {
  const { widthM, depthM, marginM } = ARENA;
  const axisLimit = (start: number, end: number, low: number, high: number) => {
    if (end > high) return (high - start) / (end - start);
    if (end < low) return (low - start) / (end - start);
    return 1;
  };
  const t = Math.min(
    axisLimit(from.xM, to.xM, marginM, widthM - marginM),
    axisLimit(from.yM, to.yM, marginM, depthM - marginM),
  );
  return { xM: from.xM + (to.xM - from.xM) * t, yM: from.yM + (to.yM - from.yM) * t };
}

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

/** 앞(+)·뒤(-) 직선 이동량. 'move' 블록은 뒤로 이동이다. */
function signedMeters(node: SerializedBlockNode): number {
  if (node.kind === 'moveForward') return node.distanceM;
  if (node.kind === 'move') return -node.distanceM;
  return 0;
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
  let position: ArenaPoint = { xM: ARENA.startXM, yM: ARENA.startYM };
  let leftArena = false;
  let failurePoint: ArenaPoint | null = null;
  const path = [position];
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
    const moved = signedMeters(node);
    if (Number.isFinite(moved) && moved !== 0 && !leftArena) {
      const radians = (heading * Math.PI) / 180;
      const next = {
        xM: position.xM + moved * Math.sin(radians),
        yM: position.yM + moved * Math.cos(radians),
      };
      // 허용 영역은 볼록하고 구간 시작점이 그 안이므로, 끝점이 안이면 구간 전체가 안이다.
      if (insideArena(next)) {
        position = next;
      } else {
        leftArena = true;
        position = exitPoint(position, next);
        if (violation === null) {
          violation = { index, code: 'exceeds-safe-zone' };
          failurePoint = position;
        }
      }
      path.push(position);
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
    path,
    failurePoint,
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
