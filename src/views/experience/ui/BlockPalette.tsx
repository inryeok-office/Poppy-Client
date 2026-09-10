'use client';

import { useMemo, useState } from 'react';

import { CATEGORIES, DEFAULT_CATEGORY, blocksInCategory } from '../model/blockCatalog';
import { newBlock, type BlockNode } from '../model/blockProgram';
import { useBlockDrag } from '../lib/useBlockDrag';
import { BlockGlyph } from './BlockStack';

// Figma node 21:520 — Frame 6(31:292, 카테고리 레일 w54, gap 4), Rectangle 3/4(레일·팔레트 패널),
// Frame 7(31:295, 블록 목록 x=109 y=245, gap 16).
// 블록을 눌러 캔버스로 끌어다 놓는다 (클릭 아님) — 스택 슬롯에 가까워지면 스냅.
// w-[85px] 같은 정확한 디자인 치수는 임의값으로 둔다.

export function BlockPalette() {
  const [category, setCategory] = useState(DEFAULT_CATEGORY);
  const { startDrag } = useBlockDrag();

  // 팔레트에 보여줄 견본 블록 (실제 드래그 노드는 pointerdown 때 새로 만든다).
  const samples = useMemo<{ kind: BlockNode['kind']; sample: BlockNode }[]>(
    () =>
      blocksInCategory(category).map((entry) => ({
        kind: entry.kind,
        sample: newBlock(entry.kind),
      })),
    [category],
  );

  return (
    <aside className="flex shrink-0" aria-label="블록 팔레트" data-block-palette>
      <nav
        className="border-line bg-page flex w-[85px] flex-col items-center gap-1 border-r pt-6"
        aria-label="블록 카테고리"
      >
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === category}
            onClick={() => setCategory(item.id)}
            className={`text-ink hover:bg-card flex w-[54px] cursor-pointer flex-col items-center gap-1 rounded-lg p-3 text-[14px] transition-colors ${
              item.id === category ? 'border-line border' : 'border border-transparent'
            }`}
          >
            <span aria-hidden className={`size-3 rounded-xs ${item.colorClass}`} />
            {item.label}
          </button>
        ))}
      </nav>

      <ul className="border-line bg-page flex w-[294px] shrink-0 flex-col gap-4 border-r-[1.5px] px-6 pt-10">
        {samples.map(({ kind, sample }) => (
          <li key={kind}>
            <button
              type="button"
              aria-label={`${blockName(kind)} 블록 꺼내기`}
              onPointerDown={(event) =>
                startDrag({ origin: 'palette', node: newBlock(kind) }, event)
              }
              className="block cursor-grab touch-none text-left active:cursor-grabbing"
            >
              <BlockGlyph node={sample} />
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}

function blockName(kind: BlockNode['kind']): string {
  switch (kind) {
    case 'wait':
      return '기다리기';
    case 'repeat':
      return '반복하기';
    case 'move':
      return '이동';
    case 'greet':
      return '인사하기';
    case 'end':
      return '종료';
    default:
      return kind;
  }
}
