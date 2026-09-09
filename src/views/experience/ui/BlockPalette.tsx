import { Block, BlockInput, CBlock } from './Block';

// Figma node 21:520 — Frame 6(31:292, 카테고리 레일 w54, gap 4), Rectangle 3/4(레일·팔레트 패널),
// Frame 7(31:295, 블록 목록 x=109 y=245, gap 16).
// w-[85px] 같은 정확한 디자인 치수는 임의값으로 둔다(IDE의 canonical class 제안은 무시).

// 카테고리 레일. 색 칩은 블록 카테고리 색(@theme block-*)과 맞춘다. 실제 선택 상태·전환은 후속 작업.
const CATEGORIES = [
  { label: '시작', color: 'bg-block-start' },
  { label: '흐름', color: 'bg-block-flow' },
  { label: '이동', color: 'bg-block-move' },
  { label: '동작', color: 'bg-block-action' },
] as const;

// 디자인상 선택돼 있는 카테고리(흐름).
const SELECTED_CATEGORY = '흐름';

export function BlockPalette() {
  return (
    <aside className="flex shrink-0" aria-label="블록 팔레트">
      <nav
        className="border-line bg-page flex w-[85px] flex-col items-center gap-1 border-r pt-6"
        aria-label="블록 카테고리"
      >
        {CATEGORIES.map((category) => (
          <button
            key={category.label}
            type="button"
            aria-pressed={category.label === SELECTED_CATEGORY}
            className={`text-ink flex w-[54px] flex-col items-center gap-1 rounded-lg p-3 text-[14px] ${
              category.label === SELECTED_CATEGORY
                ? 'border-line border'
                : 'border border-transparent'
            }`}
          >
            <span aria-hidden className={`size-3 rounded-xs ${category.color}`} />
            {category.label}
          </button>
        ))}
      </nav>

      {/* 선택된 카테고리('흐름')의 블록. TODO: 카테고리별 블록 정의는 entities/feature 레이어에서 데이터로. */}
      <ul className="border-line bg-page flex w-[294px] shrink-0 flex-col gap-4 border-r-[1.5px] px-6 pt-10">
        <li>
          <Block color="flow">
            <BlockInput />초 기다리기
          </Block>
        </li>
        <li>
          <CBlock
            color="flow"
            header={
              <>
                <BlockInput />번 반복하기
              </>
            }
          />
        </li>
      </ul>
    </aside>
  );
}
