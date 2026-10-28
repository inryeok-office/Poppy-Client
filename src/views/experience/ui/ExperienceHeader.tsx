import type { AutoSaveStatus } from '@/features/session';

import { PillButton, PoppyLogo, Tooltip } from '@/shared/ui';

// Figma node 21:520 — Rectangle 2(헤더 바 h64, 아래 경계선 1.5px), Group 1(로고 107×40, x=24),
// Frame 32(우측 버튼 묶음, gap 8, 오른쪽 여백 32).

const SAVE_LABEL: Partial<Record<AutoSaveStatus, string>> = {
  saving: '저장 중…',
  saved: '저장됨',
  invalid: '블록을 모두 연결하면 저장돼요',
  offline: '오프라인 · 이 브라우저에 저장했어요',
  rejected: '저장하지 못했어요',
  conflict: '다른 곳에서 수정됐어요',
};

type ExperienceHeaderProps = {
  /** 전체 지우기 — 시작·종료만 남기고 블록·진행을 비운다. */
  onClearAll?: () => void;
  /** 처음으로 — 블록·진행을 정리하고 체험 첫 화면(/)으로 돌아간다. */
  onRestart?: () => void;
  /** 프로젝트 자동 저장 상태 (명세 Session "프로젝트 자동 저장"). */
  saveStatus?: AutoSaveStatus;
  /** rejected·invalid 일 때 보여줄 짧은 한국어 사유 */
  saveReason?: string | null;
};

export function ExperienceHeader({
  onClearAll,
  onRestart,
  saveStatus = 'idle',
  saveReason,
}: ExperienceHeaderProps) {
  const baseLabel = SAVE_LABEL[saveStatus];
  const saveLabel =
    saveStatus === 'rejected' && saveReason
      ? `${baseLabel} · ${saveReason}`
      : saveStatus === 'invalid' && saveReason
        ? saveReason
        : baseLabel;

  return (
    <header className="border-line bg-page flex h-16 shrink-0 items-center justify-between border-b-[1.5px] pr-8 pl-6">
      <PoppyLogo className="h-10 w-auto" />

      <nav className="flex items-center gap-3">
        {saveLabel && (
          <span className="text-muted text-[13px]" aria-live="polite">
            {saveLabel}
          </span>
        )}
        <span className="flex gap-2">
          <Tooltip text="시작·종료만 남기고 블록을 모두 지워요">
            <PillButton onClick={onClearAll}>전체 지우기</PillButton>
          </Tooltip>
          <Tooltip text="체험 첫 화면으로 돌아가요 (블록은 지워져요)">
            <PillButton onClick={onRestart}>처음으로</PillButton>
          </Tooltip>
        </span>
      </nav>
    </header>
  );
}
