'use client';

import { useBlockDrag } from '../lib/useBlockDrag';
import { type BlockError, type BlockProgram } from '../model/blockProgram';
import { Block, BlockOutline, GhostBlock } from './Block';
import { BlockStack, type BlockParamPatch } from './BlockStack';
import { SectionLabel } from './SectionLabel';
import { PillButton } from '@/shared/ui';

// Figma node 21:520 / 33:483 (Slide 2·3) — 블록 조립 워크스페이스, 시뮬레이션 통과 전.
//   프로그램에 구조 오류가 있으면(예: '종료' 미연결) '시뮬레이션 하기' 비활성(아웃라인) + 안내문이 오류 메시지.
//   블록은 팔레트/캔버스에서 끌어 옮긴다. 스택 슬롯에 가까우면 스냅 연결, 아니면 놓은 자리에 그대로 둔다.
//   잡은 블록 아래에 연결된 블록은 함께 딸려온다 (기명서 "블록 드래그 이동·스냅 연결").

const DEFAULT_HINT = '반드시 ‘종료’ 블록으로 끝내주세요.';

type BlockWorkspaceProps = {
  program: BlockProgram;
  errors: BlockError[];
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
  onBlockParamChange,
  onSimulate,
  simulating = false,
  simulationMessage,
}: BlockWorkspaceProps) {
  const { dragging, startDrag, registerStack, registerCanvas } = useBlockDrag();

  const valid = errors.length === 0;
  const hint = simulationMessage ?? errors[0]?.message ?? DEFAULT_HINT;
  const dimIds = dragging?.active ? new Set(dragging.carried.map((b) => b.id)) : undefined;

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
      <div className="flex items-center justify-between gap-4 px-8 py-[18px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]" aria-live="polite">
          <span aria-hidden className="bg-block-start size-3 shrink-0 rounded-full" />
          {hint}
        </p>
        {/* primary(상하 12)가 잠김 버튼(상하 11)보다 살짝 커서 center 정렬 (Figma Frame 17). */}
        <div className="flex shrink-0 items-center gap-2">
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
            onBlockPointerDown={(node, event) =>
              startDrag({ origin: 'stack', nodeId: node.id }, event)
            }
            dimIds={dimIds}
          />
        </div>

        {/* 스냅 미리보기 — 연결될 자리에 점선 윤곽 (기명서 "연결 위치를 미리 표시").
            잡은 블록과 같은 모양(시작=모자형·종료=캡형·반복=C블록)으로, 실제 물릴 위치에 그린다. */}
        {dragging?.active && dragging.slot && dragging.carried[0] && (
          <div
            aria-hidden
            className="pointer-events-none fixed z-40"
            style={{ top: dragging.slot.y, left: dragging.slot.x }}
          >
            <BlockOutline kind={dragging.carried[0].kind} />
          </div>
        )}

        {/* 아직 연결 안 된 자유 블록 그룹 — 놓인 자리에 그대로. 끌어서 스택에 붙인다.
            잡혀서 딸려나가는 블록만 dimIds 로 흐리게 한다 (메인 스택과 동일 — 그룹 첫
            블록만 보고 통째로 숨기면, 그룹 중간을 잡았을 때 그 아래만 흐려져야 하는데
            전체가 그대로 보이면서 클론과 중복으로 보인다). */}
        {program.floating.map((group) => (
          <div
            key={group.id}
            data-floating-group
            style={{ left: group.x, top: group.y }}
            className="absolute"
          >
            <BlockStack
              nodes={group.blocks}
              onBlockPointerDown={(node, event) =>
                startDrag({ origin: 'floating', nodeId: node.id }, event)
              }
              dimIds={dimIds}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
