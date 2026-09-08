// Figma node 21:520 — Rectangle 2(헤더 바), Group 1(로고), Frame 32(우측 버튼).
export function ExperienceHeader() {
  return (
    <header className="flex items-center justify-between">
      {/* TODO: 공용 Poppy 로고 컴포넌트로 교체 (현재는 views/intro 슬라이스 내부에만 존재 → shared/ui 승격 필요) */}
      <span>Poppy</span>

      <nav className="flex">
        <button type="button">전체 지우기</button>
        <button type="button">처음으로</button>
      </nav>
    </header>
  );
}
