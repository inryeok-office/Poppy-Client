import { DIFFICULTY_LABEL, type MissionDetail } from '@/features/mission';
import { PillButton } from '@/shared/ui';

type MissionBannerProps = {
  mission: MissionDetail;
  onOpenList: () => void;
  onLeaveMission: () => void;
};

/** 미션 모드 안내 줄 — 지금 미션의 난이도·이름·목표와 목록/자유 체험 전환 버튼. */
export function MissionBanner({ mission, onOpenList, onLeaveMission }: MissionBannerProps) {
  return (
    <section
      aria-label="진행 중인 미션"
      className="border-line bg-card flex items-center justify-between gap-4 border-b-[1.5px] px-8 py-3"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="bg-primary shrink-0 rounded-full px-3 py-1 text-[13px] text-white">
          미션 · 난이도 {DIFFICULTY_LABEL[mission.difficulty]}
        </span>
        <p className="text-ink truncate text-[15px]">
          <strong className="font-normal">{mission.title}</strong>
          <span className="text-muted"> — {mission.goal}</span>
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <PillButton onClick={onOpenList}>미션 목록</PillButton>
        <PillButton onClick={onLeaveMission}>자유 체험으로</PillButton>
      </div>
    </section>
  );
}
