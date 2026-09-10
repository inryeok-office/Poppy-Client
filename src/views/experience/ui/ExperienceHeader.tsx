import type { AutoSaveStatus } from '@/features/session';

import { PillButton, PoppyLogo } from '@/shared/ui';

// Figma node 21:520 — Rectangle 2(헤더 바 h64, 아래 경계선 1.5px), Group 1(로고 107×40, x=24),
// Frame 32(우측 버튼 묶음, gap 8, 오른쪽 여백 32).

const SAVE_LABEL: Partial<Record<AutoSaveStatus, string>> = {
  saving: '저장 중…',
  saved: '저장됨',
  offline: '오프라인 · 이 브라우저에 저장했어요',
  conflict: '다른 곳에서 수정됐어요',
};

type ExperienceHeaderProps = {
  /** 전체 지우기 — 블록·진행을 비운다. */
  onClearAll?: () => void;
  /** 처음으로 — 체험 시작 상태로 되돌린다. */
  onRestart?: () => void;
  /** 프로젝트 자동 저장 상태 (명세 Session "프로젝트 자동 저장"). */
  saveStatus?: AutoSaveStatus;
};

export function ExperienceHeader({
  onClearAll,
  onRestart,
  saveStatus = 'idle',
}: ExperienceHeaderProps) {
  const saveLabel = SAVE_LABEL[saveStatus];

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
          <PillButton onClick={onClearAll}>전체 지우기</PillButton>
          <PillButton onClick={onRestart}>처음으로</PillButton>
        </span>
      </nav>
    </header>
  );
}
