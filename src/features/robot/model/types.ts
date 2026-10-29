export type RobotAvailabilityStatus = 'READY' | 'BUSY' | 'OFFLINE' | 'UNAVAILABLE';

/** GET /api/v1/robots/availability — 체험자용 읽기 전용 요약 (Server Issue #123). */
export interface RobotAvailability {
  availableCount: number;
  total: number;
  robots: { alias: string; status: RobotAvailabilityStatus }[];
}

export type RobotBadgeKind = 'ready' | 'busy' | 'offline';

export const ROBOT_BADGE_LABEL: Record<RobotBadgeKind, string> = {
  ready: '로봇 준비됨',
  busy: '로봇 사용 중',
  offline: '로봇 연결 안 됨',
};

/**
 * 한 대라도 READY 면 '준비됨', 아니면 누군가 쓰고 있으면 '사용 중', 그 외(OFFLINE·UNAVAILABLE·0대)는
 * '연결 안 됨'. UNAVAILABLE(연결은 됐지만 실행 불가)도 체험자에게는 '연결 안 됨'으로 묶는다.
 */
export function robotBadgeKind(availability: RobotAvailability): RobotBadgeKind {
  if (availability.availableCount > 0) return 'ready';
  if (availability.robots.some((robot) => robot.status === 'BUSY')) return 'busy';
  return 'offline';
}
