// Figma node 21:520 — Frame 6(31:292, 카테고리 레일), Rectangle 3/4(팔레트 패널), Frame 7(블록 목록).

// 카테고리 레일. 실제 선택 상태·전환은 후속 작업.
const CATEGORIES = ['시작', '흐름', '이동', '동작'] as const;

// 선택된 카테고리의 블록 목록. 지금은 디자인에 보이는 '흐름' 블록만 자리표시.
// TODO: 카테고리별 블록 정의는 entities/feature 레이어에서 데이터로 관리.
const SAMPLE_BLOCKS = ['초 기다리기', '번 반복하기'] as const;

export function BlockPalette() {
  return (
    <aside className="flex" aria-label="블록 팔레트">
      <nav className="flex flex-col" aria-label="블록 카테고리">
        {CATEGORIES.map((category) => (
          <button key={category} type="button">
            {category}
          </button>
        ))}
      </nav>

      <ul>
        {SAMPLE_BLOCKS.map((block) => (
          <li key={block}>{block}</li>
        ))}
      </ul>
    </aside>
  );
}
