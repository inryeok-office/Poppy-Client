import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

import { VALUE_RANGE_TEXT, isBlockValueValid, valueKindOf } from '@/features/simulation';

import {
  MOVE_RANGE,
  REPEAT_RANGE,
  ROTATE_RANGE,
  WAIT_RANGE,
  type BlockNode,
} from '../model/blockProgram';
import { Block, BlockInput, CBlock, EmptyMouth } from './Block';

// 블록 체인(program.stack / floating 그룹)을 그대로 렌더한다.
// 두 워크스페이스(조립 중·실행 준비)가 공유한다. 편집(값 입력)은 onParamChange 를 줄 때만 켜진다.
// onBlockPointerDown 을 주면 시작·종료를 뺀 블록이 드래그 핸들이 된다 (잡으면 같은 목록에서 아래
// 블록이 함께 딸려온다). 반복 블록의 입(body)도 같은 컴포넌트로 중첩 렌더한다.
// 슬롯 측정은 [data-block](data-parent = 'root' 또는 반복 id)과 반복 입 [data-mouth] 로 한다.

export type BlockParamPatch = {
  count?: number;
  distanceM?: number;
  seconds?: number;
  degrees?: number;
};

type RenderOptions = {
  onParamChange?: (id: string, patch: BlockParamPatch) => void;
  onBlockPointerDown?: (node: BlockNode, event: ReactPointerEvent) => void;
  dimIds?: Set<string>;
};

/** '뒤로 [n] m 이동' 류 — 앞뒤 라벨 사이에 값 입력 하나를 끼운 이동·회전 블록. */
function measuredBlock({
  prefix,
  suffix,
  value,
  onChange,
  range,
  ariaLabel,
  invalid,
  rangeHint,
}: {
  prefix: string;
  suffix: string;
  value: number;
  onChange?: (value: number) => void;
  range: { min: number; max: number; step?: number };
  ariaLabel: string;
  invalid: boolean;
  rangeHint: string;
}) {
  return (
    <Block color="move">
      {prefix}{' '}
      <BlockInput
        value={value}
        onChange={onChange}
        min={range.min}
        max={range.max}
        step={'step' in range ? range.step : undefined}
        invalid={invalid}
        rangeHint={rangeHint}
        aria-label={ariaLabel}
      />{' '}
      {suffix}
    </Block>
  );
}

function renderNode(node: BlockNode, options: RenderOptions): ReactNode {
  const { onParamChange } = options;
  const bind = (patch: (value: number) => BlockParamPatch) =>
    onParamChange ? (value: number) => onParamChange(node.id, patch(value)) : undefined;
  const invalid = !isBlockValueValid(node);
  const valueKind = valueKindOf(node.kind);
  const rangeHint = valueKind ? VALUE_RANGE_TEXT[valueKind].hint : '';

  switch (node.kind) {
    case 'start':
      return (
        <Block color="start" variant="hat">
          시작
        </Block>
      );
    case 'end':
      return (
        <Block color="start" variant="cap">
          종료
        </Block>
      );
    case 'greet':
      return <Block color="action">인사하기</Block>;
    case 'wait':
      return (
        <Block color="flow">
          <BlockInput
            value={node.seconds}
            onChange={bind((seconds) => ({ seconds }))}
            min={WAIT_RANGE.min}
            max={WAIT_RANGE.max}
            invalid={invalid}
            rangeHint={rangeHint}
            aria-label="기다리는 시간 (초)"
          />
          초 기다리기
        </Block>
      );
    case 'move':
      return measuredBlock({
        prefix: '뒤로',
        suffix: 'm 이동',
        value: node.distanceM,
        onChange: bind((distanceM) => ({ distanceM })),
        range: MOVE_RANGE,
        ariaLabel: '이동 거리 (미터)',
        invalid,
        rangeHint,
      });
    case 'moveForward':
      return measuredBlock({
        prefix: '앞으로',
        suffix: 'm 이동',
        value: node.distanceM,
        onChange: bind((distanceM) => ({ distanceM })),
        range: MOVE_RANGE,
        ariaLabel: '이동 거리 (미터)',
        invalid,
        rangeHint,
      });
    case 'rotateRight':
      return measuredBlock({
        prefix: '오른쪽으로',
        suffix: '° 회전',
        value: node.degrees,
        onChange: bind((degrees) => ({ degrees })),
        range: ROTATE_RANGE,
        ariaLabel: '회전 각도 (도)',
        invalid,
        rangeHint,
      });
    case 'rotateLeft':
      return measuredBlock({
        prefix: '왼쪽으로',
        suffix: '° 회전',
        value: node.degrees,
        onChange: bind((degrees) => ({ degrees })),
        range: ROTATE_RANGE,
        ariaLabel: '회전 각도 (도)',
        invalid,
        rangeHint,
      });
    case 'stop':
      return <Block color="move">정지</Block>;
    case 'sit':
      return <Block color="action">앉기</Block>;
    case 'standUp':
      return <Block color="action">일어서기</Block>;
    case 'heart':
      return <Block color="action">하트</Block>;
    case 'dance':
      return <Block color="action">춤추기</Block>;
    case 'roll':
      return <Block color="action">구르기</Block>;
    case 'attack':
      return <Block color="action">공격</Block>;
    case 'repeat':
      return (
        <CBlock
          color="flow"
          slots={node.body.length}
          header={
            <>
              <BlockInput
                value={node.count}
                onChange={bind((count) => ({ count }))}
                min={REPEAT_RANGE.min}
                max={REPEAT_RANGE.max}
                invalid={invalid}
                rangeHint={rangeHint}
                aria-label="반복 횟수"
              />
              번 반복하기
            </>
          }
        >
          {node.body.length === 0 ? (
            <div data-mouth={node.id}>
              <EmptyMouth invalid />
            </div>
          ) : (
            <>
              <div data-mouth={node.id} aria-hidden className="h-0" />
              <BlockList nodes={node.body} parentId={node.id} {...options} />
            </>
          )}
        </CBlock>
      );
  }
}

/** 편집 중인 블록 값이 허용 범위를 벗어났을 때 블록 바로 아래 한 줄 안내. */
function ValueError({ node, editable }: { node: BlockNode; editable: boolean }) {
  const valueKind = valueKindOf(node.kind);
  if (!editable || !valueKind || isBlockValueValid(node)) return null;
  return (
    <p role="alert" className="text-danger pt-2 pb-2 pl-8 text-[12px] leading-none">
      {VALUE_RANGE_TEXT[valueKind].error}
    </p>
  );
}

type BlockListProps = RenderOptions & {
  nodes: BlockNode[];
  /** 반복 body 면 그 반복 id, 스택·자유 그룹이면 null. */
  parentId?: string | null;
  containerRef?: (el: HTMLOListElement | null) => void;
};

const isFixedEntry = (node: BlockNode) => node.kind === 'start' || node.kind === 'end';

function BlockList({
  nodes,
  parentId = null,
  containerRef,
  onParamChange,
  onBlockPointerDown,
  dimIds,
}: BlockListProps) {
  const options = { onParamChange, onBlockPointerDown, dimIds };
  return (
    <ol ref={containerRef} className="flex flex-col -space-y-1.5">
      {nodes.map((node) => {
        const draggable = onBlockPointerDown != null && !isFixedEntry(node);
        return (
          <li
            key={node.id}
            data-block={node.id}
            data-kind={node.kind}
            data-parent={parentId ?? 'root'}
            onPointerDown={
              draggable
                ? (event) => {
                    // 값 입력칸을 누른 거면 편집이지 드래그가 아니다
                    if ((event.target as HTMLElement).closest('input')) return;
                    // 반복 입 안 블록을 잡으면 바깥 반복 블록까지 잡히지 않게 한다
                    event.stopPropagation();
                    onBlockPointerDown(node, event);
                  }
                : undefined
            }
            className={`${draggable ? 'cursor-grab touch-none active:cursor-grabbing' : ''} ${
              dimIds?.has(node.id) ? 'opacity-40' : ''
            }`}
          >
            {renderNode(node, options)}
            <ValueError node={node} editable={onParamChange != null} />
          </li>
        );
      })}
    </ol>
  );
}

type BlockStackProps = {
  nodes: BlockNode[];
  /** 주면 값 입력 칸이 편집 가능해진다. */
  onParamChange?: RenderOptions['onParamChange'];
  /** 스택 <ol> 요소 등록 (드래그 슬롯 측정용). */
  containerRef?: (el: HTMLOListElement | null) => void;
  /** 주면 시작·종료를 뺀 블록이 드래그 핸들이 된다. 입력칸 위에서는 시작하지 않는다. */
  onBlockPointerDown?: (node: BlockNode, event: ReactPointerEvent) => void;
  /** 지금 드래그로 딸려간 블록 id 들 — 원본을 흐리게 */
  dimIds?: Set<string>;
};

export function BlockStack(props: BlockStackProps) {
  return <BlockList {...props} />;
}
