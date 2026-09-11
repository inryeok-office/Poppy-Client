'use client';

import { newBlock } from '../model/blockProgram';
import { useBlockDrag } from '../lib/useBlockDrag';
import { Block, BlockInput, CBlock } from './Block';

// Figma node 21:520 — Frame 6(31:292, 카테고리 레일 w54, gap 4), Rectangle 3/4(레일·팔레트 패널),
// Frame 7(31:295, 블록 목록 x=109 y=245, gap 16).
// 팔레트 블록을 눌러 캔버스로 끌어다 놓는다 (기명서 "블록 드래그 이동·스냅 연결").
// 카테고리 레일은 디자인상 '흐름' 고정 (전환은 이 화면 범위 아님).
// w-[85px] 같은 정확한 디자인 치수는 임의값으로 둔다.

const CATEGORIES = [
  { label: '시작', color: 'bg-block-start' },
  { label: '흐름', color: 'bg-block-flow' },
  { label: '이동', color: 'bg-block-move' },
  { label: '동작', color: 'bg-block-action' },
] as const;

const SELECTED_CATEGORY = '흐름';

export function BlockPalette() {
  const { startDrag } = useBlockDrag();

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
            className={`text-ink hover:bg-card flex w-[54px] cursor-pointer flex-col items-center gap-1 rounded-lg p-3 text-[14px] transition-colors ${
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

      {/* 선택된 카테고리('흐름')의 블록. 눌러서 캔버스로 끌어다 놓는다. */}
      <ul className="border-line bg-page flex w-[294px] shrink-0 flex-col gap-4 border-r-[1.5px] px-6 pt-10">
        <li>
          <div
            role="button"
            aria-label="초 기다리기 블록 꺼내기"
            onPointerDown={(event) =>
              startDrag({ origin: 'palette', node: newBlock('wait') }, event)
            }
            className="inline-block cursor-grab touch-none active:cursor-grabbing"
          >
            <Block color="flow">
              <BlockInput />초 기다리기
            </Block>
          </div>
        </li>
        <li>
          <div
            role="button"
            aria-label="번 반복하기 블록 꺼내기"
            onPointerDown={(event) =>
              startDrag({ origin: 'palette', node: newBlock('repeat') }, event)
            }
            className="inline-block cursor-grab touch-none active:cursor-grabbing"
          >
            <CBlock
              color="flow"
              header={
                <>
                  <BlockInput />번 반복하기
                </>
              }
            />
          </div>
        </li>
      </ul>
    </aside>
  );
}
