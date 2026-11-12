// 체험 공간 — Server(`GET /api/v1/arena-settings`)가 단일 출처다. 조회하지 못하거나 값이 이상하면
// 지금까지의 6×6 박람회 값으로 돌아간다(안전 쪽 기본값: 설정이 없으면 이전과 똑같이 동작한다).

export type ArenaConfig = {
  /** 프리셋 코드(`6x6-박람회`·`3x3-부스`). 개별 값이면 null. */
  presetCode: string | null;
  widthM: number;
  depthM: number;
  /** 벽 여유 (m) */
  marginM: number;
  startXM: number;
  startYM: number;
  /** 출발 시 바라보는 방향 (°, +y = 0, 시계 방향) */
  startHeadingDegrees: number;
  /** 1회 이동 최대 거리 (m) — 공간에서 Server 가 계산한 값 */
  maxMovePerCommandM: number;
  /** 새 이동 블록의 권장 기본 거리 (m) */
  defaultMoveDistanceM: number;
};

/** 6×6 박람회 — Agent 의 POPPY_PHYSICAL_ARENA_* · START_* 기본 운영값과 같다. */
export const DEFAULT_ARENA: ArenaConfig = {
  presetCode: '6x6-박람회',
  widthM: 6,
  depthM: 6,
  marginM: 0.4,
  startXM: 5.6,
  startYM: 0.4,
  startHeadingDegrees: 0,
  maxMovePerCommandM: 3,
  defaultMoveDistanceM: 1,
};

/** Server 응답 모양(`ApiResponse.data`). */
export type ArenaSettingsResponse = {
  presetCode: string | null;
  widthM: number;
  depthM: number;
  marginM: number;
  startXM: number;
  startYM: number;
  startHeading: string;
  limits: {
    usableWidthM: number;
    usableDepthM: number;
    maxMovePerCommandM: number;
    defaultMoveDistanceM: number;
  };
};

const HEADING_DEGREES: Record<string, number> = { '+Y': 0, '+X': 90, '-Y': 180, '-X': 270 };

/** Agent 하드 상한과 같다 — 이보다 넓거나 여유가 작은 값은 받지 않는다(Server 가 잘못돼도 안전 경계를 넓히지 않는다). */
const MAX_SIDE_M = 6;
const MIN_MARGIN_M = 0.4;
const MAX_MOVE_M = 3;
const EPS = 1e-9;

const isNum = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Server 응답을 검증해 ArenaConfig 로 바꾼다. 하나라도 이상하면 null → 호출한 쪽이 DEFAULT_ARENA 를 쓴다.
 * 한 변 6 m 초과, 벽 여유 0.4 m 미만, 출발점이 여유 밖, 1회 이동 한도가 가용 영역 밖이면 거부한다.
 */
export function arenaFromResponse(response: unknown): ArenaConfig | null {
  if (typeof response !== 'object' || response === null) return null;
  const r = response as Partial<ArenaSettingsResponse>;
  const { widthM, depthM, marginM, startXM, startYM, startHeading, limits } = r;
  if (!isNum(widthM) || !isNum(depthM) || !isNum(marginM) || !isNum(startXM) || !isNum(startYM)) {
    return null;
  }
  if (typeof startHeading !== 'string' || !(startHeading in HEADING_DEGREES)) return null;
  if (typeof limits !== 'object' || limits === null) return null;
  const { maxMovePerCommandM, defaultMoveDistanceM } = limits;
  if (!isNum(maxMovePerCommandM) || !isNum(defaultMoveDistanceM)) return null;

  if (widthM <= 0 || depthM <= 0 || widthM > MAX_SIDE_M + EPS || depthM > MAX_SIDE_M + EPS) {
    return null;
  }
  if (marginM < MIN_MARGIN_M - EPS) return null;
  const usableShort = Math.min(widthM, depthM) - 2 * marginM;
  if (usableShort <= 0) return null;
  if (
    startXM < marginM - EPS ||
    startXM > widthM - marginM + EPS ||
    startYM < marginM - EPS ||
    startYM > depthM - marginM + EPS
  ) {
    return null;
  }
  if (maxMovePerCommandM <= 0 || maxMovePerCommandM > MAX_MOVE_M + EPS) return null;
  if (maxMovePerCommandM > usableShort + EPS) return null;
  if (defaultMoveDistanceM <= 0 || defaultMoveDistanceM > maxMovePerCommandM + EPS) return null;

  return {
    presetCode: typeof r.presetCode === 'string' ? r.presetCode : null,
    widthM,
    depthM,
    marginM,
    startXM,
    startYM,
    startHeadingDegrees: HEADING_DEGREES[startHeading],
    maxMovePerCommandM,
    defaultMoveDistanceM,
  };
}

/** 이동 블록 입력 범위 — 최대값이 공간을 따른다. */
export function moveRangeFor(arena: ArenaConfig) {
  return { min: 0.1, max: arena.maxMovePerCommandM, step: 0.1 } as const;
}

/** 가용 영역 한 변 문구(예: "2m"). */
export const formatMeters = (value: number): string => `${Math.round(value * 100) / 100}`;
