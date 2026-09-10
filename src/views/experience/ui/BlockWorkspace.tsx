'use client';

import { useBlockDrag } from '../lib/useBlockDrag';
import { type BlockError, type BlockProgram } from '../model/blockProgram';
import { Block, GhostBlock } from './Block';
import { BlockGlyph, BlockStack, type BlockParamPatch } from './BlockStack';
import { SectionLabel } from './SectionLabel';
import { PillButton } from '@/shared/ui';

// Figma node 21:520 / 33:483 (Slide 2·3) — 블록 조립 워크스페이스, 시뮬레이션 통과 전.
//   프로그램에 구조 오류가 있으면(예: '종료' 미연결) '시뮬레이션 하기' 비활성(아웃라인) + 안내문이 오류 메시지.
//   블록은 팔레트에서 끌어다 놓고, 스택 블록은 끌어서 재정렬하거나 캔버스 밖으로 빼서 지운다.
//   떨어진 '종료' 도 끌어서 붙인다 (마우스는 드래그, 키보드는 Enter). 시뮬레이션 상태는 ExperienceView 가 소유.

const DEFAULT_HINT = '반드시 ‘종료’ 블록으로 끝내주세요.';

// Figma 블록 폭 212 — 스냅 인디케이터 길이.
const BLOCK_WIDTH = 212;

type BlockWorkspaceProps = {
  program: BlockProgram;
  errors: BlockError[];
  /** 떨어진 '종료' 블록의 키보드(Enter) 연결 — 마우스는 드래그로 붙인다 */
  onConnectBlock?: () => void;
  /** 블록 값(반복 횟수·이동 거리 등) 편집 */
  onBlockParamChange?: (id: string, patch: BlockParamPatch) => void;
  onSimulate?: () => void;
  /** 시뮬레이션 검증 중 — 버튼 라벨을 바꾸고 재클릭을 막는다. */
  simulating?: boolean;
  /** 시뮬레이션이 통과하지 못한 이유 (안전 제한 위반 / 요청 실패). */
  simulationMessage?: string;
};

export function BlockWorkspace({
  program,
  errors,
  onConnectBlock,
  onBlockParamChange,
  onSimulate,
  simulating = false,
  simulationMessage,
}: BlockWorkspaceProps) {
  const { dragging, startDrag, registerStack, registerCanvas } = useBlockDrag();

  const valid = errors.length === 0;
  const hint = simulationMessage ?? errors[0]?.message ?? DEFAULT_HINT;
  const detachedEnd = program.detached.filter((node) => node.kind === 'end');

  return (
    <section className="bg-page flex flex-1 flex-col" aria-label="블록 워크스페이스">
      {/* 튜토리얼 */}
      <div>
        <div className="flex items-center justify-between px-8 py-[18px]">
          <SectionLabel>튜토리얼</SectionLabel>
          <PillButton>건너뛰기</PillButton>
        </div>
        {/* 목표 블록 예시 (Group 8·9) */}
        <div className="border-line bg-card dot-grid h-[258px] border-y-[1.5px] px-8 pt-[26px]">
          <ol className="flex flex-col -space-y-1.5">
            <li>
              <Block color="start" variant="hat">
                시작
              </Block>
            </li>
            <li>
              <GhostBlock>다음 블록을 붙여주세요</GhostBlock>
            </li>
          </ol>
        </div>
      </div>

      {/* 안내문(구조 오류 시 오류 메시지) + 실행 버튼. */}
      <div className="flex items-center justify-between px-8 py-[18px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]" aria-live="polite">
          <span aria-hidden className="bg-block-start size-3 rounded-full" />
          {hint}
        </p>
        {/* primary(상하 12)가 잠김 버튼(상하 11)보다 살짝 커서 center 정렬 (Figma Frame 17). */}
        <div className="flex items-center gap-2">
          {valid ? (
            <PillButton variant="primary" onClick={onSimulate}>
              {simulating ? '시뮬레이션 중…' : '시뮬레이션 하기'}
            </PillButton>
          ) : (
            // 구조 오류가 있으면 시뮬레이션을 막는다 (명세 Simulation)
            <PillButton aria-disabled>시뮬레이션 하기</PillButton>
          )}
          {/* 시뮬레이션 통과 기록이 없어 잠김 (명세 Execution) */}
          <PillButton aria-disabled>
            로봇 실행하기<span className="text-[13px]">• 잠김</span>
          </PillButton>
        </div>
      </div>

      {/* 블록 조립 캔버스 (Rectangle 7). */}
      <div
        ref={registerCanvas}
        data-block-canvas
        className="border-line bg-card dot-grid relative min-h-[453px] flex-1 border-t-[1.5px]"
        role="region"
        aria-label="블록 조립 캔버스"
      >
        <div className="absolute top-[88px] left-[52px]">
          <BlockStack
            nodes={program.stack}
            onParamChange={onBlockParamChange}
            containerRef={registerStack}
            onBlockPointerDown={(node, event) => startDrag({ origin: 'stack', node }, event)}
            draggingId={dragging?.source.origin === 'stack' ? dragging.source.node.id : null}
          />
        </div>

        {/* 스냅 인디케이터 — 드래그 중 블록이 붙을 자리 (Figma 블록 폭 212). */}
        {dragging?.active && dragging.slot && (
          <div
            aria-hidden
            className="bg-primary pointer-events-none fixed z-40 h-[6px] -translate-y-1/2 rounded-full"
            style={{ top: dragging.slot.y, left: dragging.slot.x, width: BLOCK_WIDTH }}
          />
        )}

        {/* 아직 연결 안 된 '종료' 블록 — 끌어서 스택에 붙인다 (Figma Slide 2 Group 11). */}
        {detachedEnd.map((node) => (
          <button
            key={node.id}
            type="button"
            aria-label="종료 블록 연결하기"
            onPointerDown={(event) => startDrag({ origin: 'detached', node }, event)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onConnectBlock?.();
              }
            }}
            className="absolute top-[174px] left-[325px] cursor-grab touch-none transition active:cursor-grabbing"
          >
            <BlockGlyph node={node} />
          </button>
        ))}
      </div>
    </section>
  );
}
