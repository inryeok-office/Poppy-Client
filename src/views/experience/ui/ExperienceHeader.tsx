import { PillButton, PoppyLogo } from '@/shared/ui';

// Figma node 21:520 — Rectangle 2(헤더 바 h64, 아래 경계선 1.5px), Group 1(로고 107×40, x=24),
// Frame 32(우측 버튼 묶음, gap 8, 오른쪽 여백 32).
export function ExperienceHeader() {
  return (
    <header className="border-line bg-page flex h-16 shrink-0 items-center justify-between border-b-[1.5px] pr-8 pl-6">
      <PoppyLogo className="h-10 w-auto" />

      <nav className="flex gap-2">
        <PillButton>전체 지우기</PillButton>
        <PillButton>처음으로</PillButton>
      </nav>
    </header>
  );
}
