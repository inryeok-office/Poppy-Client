import type { ReactNode } from 'react';

import { MOVE_RANGE, REPEAT_RANGE, WAIT_RANGE, type BlockNode } from '../model/blockProgram';
import { Block, BlockInput, CBlock } from './Block';

// 블록 트리(program.stack / program.detached)를 그대로 렌더한다.
// 두 워크스페이스(조립 중·실행 준비)가 공유한다. 편집(값 입력)은 onParamChange 를 줄 때만 켜진다.
// 드래그 재정렬 핸들은 후속 조각에서 이 위에 얹는다. 슬롯 측정은 각 블록의 [data-block] 로 한다.

export type BlockParamPatch = { count?: number; distanceM?: number; seconds?: number };

type RenderOptions = {
  onParamChange?: (id: string, patch: BlockParamPatch) => void;
};

function renderNode(node: BlockNode, options: RenderOptions): ReactNode {
  const { onParamChange } = options;
  const bind = (patch: (value: number) => BlockParamPatch) =>
    onParamChange ? (value: number) => onParamChange(node.id, patch(value)) : undefined;

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
            aria-label="기다리는 시간 (초)"
          />
          초 기다리기
        </Block>
      );
    case 'move':
      return (
        <Block color="move">
          뒤로{' '}
          <BlockInput
            value={node.distanceM}
            onChange={bind((distanceM) => ({ distanceM }))}
            min={MOVE_RANGE.min}
            max={MOVE_RANGE.max}
            aria-label="이동 거리 (미터)"
          />{' '}
          m 이동
        </Block>
      );
    case 'repeat':
      return (
        <CBlock
          color="flow"
          header={
            <>
              <BlockInput
                value={node.count}
                onChange={bind((count) => ({ count }))}
                min={REPEAT_RANGE.min}
                max={REPEAT_RANGE.max}
                aria-label="반복 횟수"
              />
              번 반복하기
            </>
          }
        >
          {node.body.map((child) => (
            <div key={child.id}>{renderNode(child, options)}</div>
          ))}
        </CBlock>
      );
  }
}

/** 블록 하나의 시각 표현 (li·편집 없이). 드래그 클론·팔레트가 재사용한다. */
export function BlockGlyph({
  node,
  onParamChange,
}: {
  node: BlockNode;
  onParamChange?: RenderOptions['onParamChange'];
}) {
  return <>{renderNode(node, { onParamChange })}</>;
}

type BlockStackProps = {
  nodes: BlockNode[];
  /** 주면 값 입력 칸이 편집 가능해진다. */
  onParamChange?: RenderOptions['onParamChange'];
  /** 스택 <ol> 요소 등록 (드래그 슬롯 측정용). */
  containerRef?: (el: HTMLOListElement | null) => void;
};

export function BlockStack({ nodes, onParamChange, containerRef }: BlockStackProps) {
  return (
    <ol ref={containerRef} className="flex flex-col -space-y-1.5">
      {nodes.map((node) => (
        <li key={node.id} data-block={node.id}>
          {renderNode(node, { onParamChange })}
        </li>
      ))}
    </ol>
  );
}
