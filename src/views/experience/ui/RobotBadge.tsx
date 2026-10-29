import { ROBOT_BADGE_LABEL, type RobotBadgeKind } from '@/features/robot';

const BADGE_CLASS: Record<RobotBadgeKind, string> = {
  ready: 'border-success bg-success-bg text-success',
  busy: 'border-block-move bg-card text-ink',
  offline: 'border-danger bg-danger-bg text-danger',
};

const DOT_CLASS: Record<RobotBadgeKind, string> = {
  ready: 'bg-success',
  busy: 'bg-block-move',
  offline: 'bg-danger',
};

/** 로봇 실행 준비가 안 됐을 때 '로봇 실행하기' 옆에 보이는 안내. */
export const ROBOT_NOT_READY_HINT: Record<Exclude<RobotBadgeKind, 'ready'>, string> = {
  busy: '다른 친구가 로봇을 쓰는 중이에요. 실행하면 순서를 기다려요.',
  offline: '로봇이 아직 준비되지 않았어요. 진행요원에게 알려 주세요.',
};

// 체험자용 로봇 상태 배지 (GET /api/v1/robots/availability, 10초 폴링).
export function RobotBadge({ kind }: { kind: RobotBadgeKind }) {
  return (
    <span
      data-testid="robot-badge"
      data-kind={kind}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] ${BADGE_CLASS[kind]}`}
    >
      <span aria-hidden className={`size-2 rounded-full ${DOT_CLASS[kind]}`} />
      {ROBOT_BADGE_LABEL[kind]}
    </span>
  );
}
