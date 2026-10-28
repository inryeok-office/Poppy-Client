'use client';

import { useState, type ReactNode } from 'react';

import {
  DEFAULT_MOVE_M,
  DEFAULT_REPEAT_COUNT,
  DEFAULT_ROTATE_DEG,
  DEFAULT_WAIT_SECONDS,
  newBlock,
  type BlockKind,
} from '../model/blockProgram';
import { useBlockDrag } from '../lib/useBlockDrag';
import { Tooltip } from '@/shared/ui';

import { Block, BlockInput, CBlock } from './Block';

// Figma node 21:520 — Frame 6(31:292, 카테고리 레일 w54, gap 4), Rectangle 3/4(레일·팔레트 패널),
// Frame 7(31:295, 블록 목록 x=109 y=245, gap 16).
// Figma node 34:951 — 카테고리 4개(시작·흐름·이동·동작)를 각각 선택했을 때 팔레트가 보여주는
// 블록 목록 레퍼런스. 카테고리 레일 클릭으로 목록이 바뀐다.
// 팔레트 블록을 눌러 캔버스로 끌어다 놓는다 (기명서 "블록 드래그 이동·스냅 연결").
// w-[85px] 같은 정확한 디자인 치수는 임의값으로 둔다.

// 시작·종료는 캔버스에 고정된 Entry 라 팔레트에서 꺼내지 않는다 (Notion 블록 편집기 명세).
const CATEGORIES = [
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

// 카테고리별 블록 종류 — 미션 모드에서 허용 블록이 하나도 없는 카테고리는 숨긴다.
const CATEGORY_KINDS: Record<CategoryLabel, BlockKind[]> = {
  흐름: ['wait', 'repeat'],
  이동: ['moveForward', 'move', 'rotateRight', 'rotateLeft', 'stop'],
  동작: ['sit', 'standUp', 'greet', 'heart', 'dance'],
};

type BlockPaletteProps = {
  /** 미션 모드면 그 미션이 허용한 블록 종류만 보인다. 없으면 자유 모드(전부). */
  allowedKinds?: ReadonlySet<BlockKind>;
};

export function BlockPalette({ allowedKinds }: BlockPaletteProps = {}) {
  const shows = (kind: BlockKind) => !allowedKinds || allowedKinds.has(kind);
  const categories = CATEGORIES.filter((c) => CATEGORY_KINDS[c.label].some(shows));
  const [picked, setCategory] = useState<CategoryLabel>('흐름');
  // 고른 카테고리가 이 미션에 없으면 보이는 첫 카테고리를 쓴다.
  const category = categories.some((c) => c.label === picked)
    ? picked
    : (categories[0]?.label ?? picked);

  return (
    <aside className="flex shrink-0" aria-label="블록 팔레트">
      <nav
        className="border-line bg-page flex w-[85px] flex-col items-center gap-1 border-r pt-6"
        aria-label="블록 카테고리"
      >
        {categories.map((c) => (
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
        {category === '흐름' && (
          <>
            {shows('wait') && (
              <PaletteItem kind="wait" ariaLabel="초 기다리기 블록 꺼내기">
                <Block color="flow">
                  <BlockInput value={DEFAULT_WAIT_SECONDS} />초 기다리기
                </Block>
              </PaletteItem>
            )}
            {shows('repeat') && (
              <PaletteItem kind="repeat" ariaLabel="번 반복하기 블록 꺼내기">
                <CBlock
                  color="flow"
                  header={
                    <>
                      <BlockInput value={DEFAULT_REPEAT_COUNT} />번 반복하기
                    </>
                  }
                />
              </PaletteItem>
            )}
          </>
        )}

        {category === '이동' && (
          <>
            {/* 순서: 앞으로 → 뒤로 → 오른쪽 → 왼쪽 → 정지 */}
            {shows('moveForward') && (
              <PaletteItem kind="moveForward" ariaLabel="앞으로 이동 블록 꺼내기">
                <Block color="move">
                  앞으로 <BlockInput value={DEFAULT_MOVE_M} /> m 이동
                </Block>
              </PaletteItem>
            )}
            {shows('move') && (
              <PaletteItem kind="move" ariaLabel="뒤로 이동 블록 꺼내기">
                <Block color="move">
                  뒤로 <BlockInput value={DEFAULT_MOVE_M} /> m 이동
                </Block>
              </PaletteItem>
            )}
            {shows('rotateRight') && (
              <PaletteItem kind="rotateRight" ariaLabel="오른쪽으로 회전 블록 꺼내기">
                <Block color="move">
                  오른쪽으로 <BlockInput value={DEFAULT_ROTATE_DEG} /> ° 회전
                </Block>
              </PaletteItem>
            )}
            {shows('rotateLeft') && (
              <PaletteItem kind="rotateLeft" ariaLabel="왼쪽으로 회전 블록 꺼내기">
                <Block color="move">
                  왼쪽으로 <BlockInput value={DEFAULT_ROTATE_DEG} /> ° 회전
                </Block>
              </PaletteItem>
            )}
            {shows('stop') && (
              <PaletteItem kind="stop" ariaLabel="정지 블록 꺼내기">
                <Tooltip text="동작을 마치고 멈춰요 (비상정지 아님)">
                  <Block color="move">정지</Block>
                </Tooltip>
              </PaletteItem>
            )}
          </>
        )}

        {category === '동작' && (
          <>
            {shows('sit') && (
              <PaletteItem kind="sit" ariaLabel="앉기 블록 꺼내기">
                <Block color="action">앉기</Block>
              </PaletteItem>
            )}
            {shows('standUp') && (
              <PaletteItem kind="standUp" ariaLabel="일어서기 블록 꺼내기">
                <Block color="action">일어서기</Block>
              </PaletteItem>
            )}
            {shows('greet') && (
              <PaletteItem kind="greet" ariaLabel="인사하기 블록 꺼내기">
                <Block color="action">인사하기</Block>
              </PaletteItem>
            )}
            {shows('heart') && (
              <PaletteItem kind="heart" ariaLabel="하트 블록 꺼내기">
                <Block color="action">하트</Block>
              </PaletteItem>
            )}
            {shows('dance') && (
              <PaletteItem kind="dance" ariaLabel="춤추기 블록 꺼내기">
                <Block color="action">춤추기</Block>
              </PaletteItem>
            )}
            {/* 구르기·공격은 검증된 프리셋이 없어 노출하지 않는다 (Server 계약에도 없음). */}
          </>
        )}
      </ul>
    </aside>
  );
}
