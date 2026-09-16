'use client';

import { useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

import { hasBlockKind, newBlock, type BlockKind, type BlockProgram } from '../model/blockProgram';
import { useBlockDrag } from '../lib/useBlockDrag';
import { Block, BlockInput, CBlock } from './Block';

// Figma node 21:520 — Frame 6(31:292, 카테고리 레일 w54, gap 4), Rectangle 3/4(레일·팔레트 패널),
// Frame 7(31:295, 블록 목록 x=109 y=245, gap 16).
// Figma Slide 5(34:951) — 카테고리 4개(시작·흐름·이동·동작)의 전체 블록 목록 레퍼런스.
// 팔레트 블록을 눌러 캔버스로 끌어다 놓는다 (기명서 "블록 드래그 이동·스냅 연결").
// w-[85px] 같은 정확한 디자인 치수는 임의값으로 둔다.

const CATEGORIES = [
  { label: '시작', color: 'bg-block-start' },
  { label: '흐름', color: 'bg-block-flow' },
  { label: '이동', color: 'bg-block-move' },
  { label: '동작', color: 'bg-block-action' },
] as const;

type CategoryLabel = (typeof CATEGORIES)[number]['label'];

/** 팔레트에서 끌어다 놓는 블록 하나. 눌러 startDrag 시작 — 값 입력칸은 CBlock/wait 처럼 자리표시만. */
function PaletteBlockItem({
  ariaLabel,
  kind,
  onGrab,
  children,
}: {
  ariaLabel: string;
  kind: BlockKind;
  onGrab: (node: ReturnType<typeof newBlock>, event: ReactPointerEvent) => void;
  children: ReactNode;
}) {
  return (
    <li>
      <div
        role="button"
        aria-label={ariaLabel}
        onPointerDown={(event) => onGrab(newBlock(kind), event)}
        className="inline-block cursor-grab touch-none active:cursor-grabbing"
      >
        {children}
      </div>
    </li>
  );
}

type BlockPaletteProps = {
  /** 시작·종료가 이미 있는지 확인용 — 둘 다 프로그램에 하나만 있어야 해서 중복 생성을 막는다. */
  program: BlockProgram;
};

export function BlockPalette({ program }: BlockPaletteProps) {
  const { startDrag } = useBlockDrag();
  const [selectedCategory, setSelectedCategory] = useState<CategoryLabel>('흐름');
  const endExists = hasBlockKind(program, 'end');

  const grab = (node: ReturnType<typeof newBlock>, event: ReactPointerEvent) =>
    startDrag({ origin: 'palette', node }, event);

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
            aria-pressed={category.label === selectedCategory}
            onClick={() => setSelectedCategory(category.label)}
            className={`text-ink hover:bg-card flex w-[54px] cursor-pointer flex-col items-center gap-1 rounded-lg p-3 text-[14px] transition-colors ${
              category.label === selectedCategory
                ? 'border-line border'
                : 'border border-transparent'
            }`}
          >
            <span aria-hidden className={`size-3 rounded-xs ${category.color}`} />
            {category.label}
          </button>
        ))}
      </nav>

      {/* 선택된 카테고리의 블록. 눌러서 캔버스로 끌어다 놓는다. */}
      <ul
        aria-label="선택된 카테고리 블록"
        className="border-line bg-page flex w-[294px] shrink-0 flex-col gap-4 border-r-[1.5px] px-6 pt-10"
      >
        {selectedCategory === '시작' && (
          <>
            {/* 시작은 프로그램에 정확히 하나만 있어야 한다(스택 맨 앞, 고정) — 팔레트에서
                새로 꺼낼 수 없게 그림만 보여준다(끌어다 놓을 수 없음). */}
            <li>
              <Block color="start" variant="hat">
                시작
              </Block>
            </li>
            {/* 종료도 많아야 하나 — 이미 있으면(스택이든 자유 블록이든) 더 꺼낼 수 없다.
                기존 인스턴스가 없을 때만 draggable 로 보여준다. */}
            {endExists ? (
              <li>
                <Block color="start" variant="cap">
                  종료
                </Block>
              </li>
            ) : (
              <PaletteBlockItem ariaLabel="종료 블록 꺼내기" kind="end" onGrab={grab}>
                <Block color="start" variant="cap">
                  종료
                </Block>
              </PaletteBlockItem>
            )}
          </>
        )}

        {selectedCategory === '흐름' && (
          <>
            <PaletteBlockItem ariaLabel="초 기다리기 블록 꺼내기" kind="wait" onGrab={grab}>
              <Block color="flow">
                <BlockInput />초 기다리기
              </Block>
            </PaletteBlockItem>
            <li>
              <div
                role="button"
                aria-label="번 반복하기 블록 꺼내기"
                onPointerDown={(event) => grab(newBlock('repeat'), event)}
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
          </>
        )}

        {selectedCategory === '이동' && (
          <>
            <PaletteBlockItem ariaLabel="뒤로 이동 블록 꺼내기" kind="move" onGrab={grab}>
              <Block color="move">
                뒤로 <BlockInput /> m 이동
              </Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="앞으로 이동 블록 꺼내기" kind="moveForward" onGrab={grab}>
              <Block color="move">
                앞으로 <BlockInput /> m 이동
              </Block>
            </PaletteBlockItem>
            <PaletteBlockItem
              ariaLabel="오른쪽으로 회전 블록 꺼내기"
              kind="turnRight"
              onGrab={grab}
            >
              <Block color="move">
                오른쪽으로 <BlockInput />° 이동
              </Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="왼쪽으로 회전 블록 꺼내기" kind="turnLeft" onGrab={grab}>
              <Block color="move">
                왼쪽으로 <BlockInput />° 이동
              </Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="정지 블록 꺼내기" kind="stop" onGrab={grab}>
              <Block color="move">정지</Block>
            </PaletteBlockItem>
          </>
        )}

        {selectedCategory === '동작' && (
          <>
            <PaletteBlockItem ariaLabel="앉기 블록 꺼내기" kind="sit" onGrab={grab}>
              <Block color="action">앉기</Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="일어서기 블록 꺼내기" kind="standUp" onGrab={grab}>
              <Block color="action">일어서기</Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="인사하기 블록 꺼내기" kind="greet" onGrab={grab}>
              <Block color="action">인사하기</Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="하트 블록 꺼내기" kind="heart" onGrab={grab}>
              <Block color="action">하트</Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="춤추기 블록 꺼내기" kind="dance" onGrab={grab}>
              <Block color="action">춤추기</Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="구르기 블록 꺼내기" kind="rollOver" onGrab={grab}>
              <Block color="action">구르기</Block>
            </PaletteBlockItem>
            <PaletteBlockItem ariaLabel="공격 블록 꺼내기" kind="attack" onGrab={grab}>
              <Block color="action">공격</Block>
            </PaletteBlockItem>
          </>
        )}
      </ul>
    </aside>
  );
}
