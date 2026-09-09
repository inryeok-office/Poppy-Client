/** 초록 점 + 텍스트 소제목 (Figma Frame 8 / Frame 18). */
export function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-ink flex items-center gap-1.5 text-[14px]">
      <span aria-hidden className="bg-block-start size-3 rounded-full" />
      {children}
    </span>
  );
}
