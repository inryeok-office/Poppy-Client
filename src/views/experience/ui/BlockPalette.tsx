'use client';

import { useState, type ReactNode } from 'react';

import { hasBlockKind, newBlock, type BlockKind, type BlockProgram } from '../model/blockProgram';
import { useBlockDrag } from '../lib/useBlockDrag';
import { Block, BlockInput, CBlock } from './Block';

// Figma node 21:520 — Frame 6(31:292, 카테고리 레일 w54, gap 4), Rectangle 3/4(레일·팔레트 패널),
// Frame 7(31:295, 블록 목록 x=109 y=245, gap 16).
// Figma node 34:951 — 카테고리 4개(시작·흐름·이동·동작)를 각각 선택했을 때 팔레트가 보여주는
// 블록 목록 레퍼런스. 카테고리 레일 클릭으로 목록이 바뀐다.
// 팔레트 블록을 눌러 캔버스로 끌어다 놓는다 (기명서 "블록 드래그 이동·스냅 연결").
// w-[85px] 같은 정확한 디자인 치수는 임의값으로 둔다.

const CATEGORIES = [
  { label: '시작', color: 'bg-block-start' },
  { label: '흐름', color: 'bg-block-flow' },
  { label: '이동', color: 'bg-block-move' },
  { label: '동작', color: 'bg-block-action' },
] as const;

type CategoryLabel = (typeof CATEGORIES)[number]['label'];

/**
 * 팔레트 한 줄 — kind 를 주면 캔버스로 꺼낼 수 있다: 포인터는 드래그해 원하는 자리에,
 * 키보드는 Enter/Space 로 스택 맨 끝에 바로 연결한다(드래그의 키보드 대체 경로 — PR #31 리뷰).
 * kind 가 없으면(시작 미리보기, 이미 있는 종료 등) 모양만 보여주는 비활성 항목이다.
 */
function PaletteItem({
  kind,
  ariaLabel,
  children,
}: {
  kind?: BlockKind;
  ariaLabel: string;
  children: ReactNode;
}) {
  const { startDrag, addToStackEnd } = useBlockDrag();

  return (
    <li>
      <div
        role={kind ? 'button' : undefined}
        tabIndex={kind ? 0 : undefined}
        aria-label={ariaLabel}
        onPointerDown={
          kind
            ? (event) => startDrag({ origin: 'palette', node: newBlock(kind) }, event)
            : undefined
        }
        onKeyDown={
          kind
            ? (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                addToStackEnd(newBlock(kind));
              }
            : undefined
        }
        className={`inline-block ${kind ? 'cursor-grab touch-none active:cursor-grabbing' : ''}`}
      >
        {children}
      </div>
    </li>
  );
}

type BlockPaletteProps = {
  /** 종료가 이미 있는지 확인용 — 쓰레기통으로 지운 뒤 다시 꺼낼 수 있어야 한다(기명서
   *  "블록 삭제"). 카테고리와 무관하게 하나만 있어야 하는 블록이라 여기서 조건을 건다. */
  program: BlockProgram;
};

export function BlockPalette({ program }: BlockPaletteProps) {
  const [category, setCategory] = useState<CategoryLabel>('흐름');
  const endExists = hasBlockKind(program, 'end');

  return (
    <aside className="flex shrink-0" aria-label="블록 팔레트">
      <nav
        className="border-line bg-page flex w-[85px] flex-col items-center gap-1 border-r pt-6"
        aria-label="블록 카테고리"
      >
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            type="button"
            aria-pressed={c.label === category}
            onClick={() => setCategory(c.label)}
            className={`text-ink hover:bg-card flex w-[54px] cursor-pointer flex-col items-center gap-1 rounded-lg p-3 text-[14px] transition-colors ${
              c.label === category ? 'border-line border' : 'border border-transparent'
            }`}
          >
            <span aria-hidden className={`size-3 rounded-xs ${c.color}`} />
            {c.label}
          </button>
        ))}
      </nav>

      {/* 선택된 카테고리의 블록. 눌러서 캔버스로 끌어다 놓는다. */}
      <ul className="border-line bg-page flex w-[294px] shrink-0 flex-col gap-4 border-r-[1.5px] px-6 pt-10">
        {category === '시작' && (
          <>
            {/* 시작은 항상 스택 맨 앞에 하나뿐이라 팔레트에서 새로 꺼낼 수 없다 — 모양만 보여준다. */}
            <PaletteItem ariaLabel="시작 블록 (캔버스에 이미 있음)">
              <Block color="start" variant="hat">
                시작
              </Block>
            </PaletteItem>
            {/* 종료도 많아야 하나 — 쓰레기통으로 지운 뒤(기명서 "블록 삭제")에는 다시 꺼낼
                방법이 있어야 한다. 이미 있으면(스택이든 자유 블록이든) 중복 생성을 막기
                위해 그림만 보여준다. */}
            {endExists ? (
              <PaletteItem ariaLabel="종료 블록 (캔버스에 이미 있음)">
                <Block color="start" variant="cap">
                  종료
                </Block>
              </PaletteItem>
            ) : (
              <PaletteItem kind="end" ariaLabel="종료 블록 꺼내기">
                <Block color="start" variant="cap">
                  종료
                </Block>
              </PaletteItem>
            )}
          </>
        )}

        {category === '흐름' && (
          <>
            <PaletteItem kind="wait" ariaLabel="초 기다리기 블록 꺼내기">
              <Block color="flow">
                <BlockInput />초 기다리기
              </Block>
            </PaletteItem>
            <PaletteItem kind="repeat" ariaLabel="번 반복하기 블록 꺼내기">
              <CBlock
                color="flow"
                header={
                  <>
                    <BlockInput />번 반복하기
                  </>
                }
              />
            </PaletteItem>
          </>
        )}

        {category === '이동' && (
          <>
            <PaletteItem kind="move" ariaLabel="뒤로 이동 블록 꺼내기">
              <Block color="move">
                뒤로 <BlockInput /> m 이동
              </Block>
            </PaletteItem>
            <PaletteItem kind="moveForward" ariaLabel="앞으로 이동 블록 꺼내기">
              <Block color="move">
                앞으로 <BlockInput /> m 이동
              </Block>
            </PaletteItem>
            <PaletteItem kind="rotateRight" ariaLabel="오른쪽으로 회전 블록 꺼내기">
              <Block color="move">
                오른쪽으로 <BlockInput /> ° 이동
              </Block>
            </PaletteItem>
            <PaletteItem kind="rotateLeft" ariaLabel="왼쪽으로 회전 블록 꺼내기">
              <Block color="move">
                왼쪽으로 <BlockInput /> ° 이동
              </Block>
            </PaletteItem>
            <PaletteItem kind="stop" ariaLabel="정지 블록 꺼내기">
              <Block color="move">정지</Block>
            </PaletteItem>
          </>
        )}

        {category === '동작' && (
          <>
            <PaletteItem kind="sit" ariaLabel="앉기 블록 꺼내기">
              <Block color="action">앉기</Block>
            </PaletteItem>
            <PaletteItem kind="standUp" ariaLabel="일어서기 블록 꺼내기">
              <Block color="action">일어서기</Block>
            </PaletteItem>
            <PaletteItem kind="greet" ariaLabel="인사하기 블록 꺼내기">
              <Block color="action">인사하기</Block>
            </PaletteItem>
            <PaletteItem kind="heart" ariaLabel="하트 블록 꺼내기">
              <Block color="action">하트</Block>
            </PaletteItem>
            <PaletteItem kind="dance" ariaLabel="춤추기 블록 꺼내기">
              <Block color="action">춤추기</Block>
            </PaletteItem>
            <PaletteItem kind="roll" ariaLabel="구르기 블록 꺼내기">
              <Block color="action">구르기</Block>
            </PaletteItem>
            <PaletteItem kind="attack" ariaLabel="공격 블록 꺼내기">
              <Block color="action">공격</Block>
            </PaletteItem>
          </>
        )}
      </ul>
    </aside>
  );
}
