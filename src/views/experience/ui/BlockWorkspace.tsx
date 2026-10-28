'use client';

import { useEffect } from 'react';

import type { SimulationResult } from '@/features/simulation';

import { useBlockDrag } from '../lib/useBlockDrag';
import { type BlockError, type BlockProgram } from '../model/blockProgram';
import type { GuideStep } from '../model/guide';
import { BlockOutline } from './Block';
import { BlockStack, type BlockParamPatch } from './BlockStack';
import { DragHint, GuideBar } from './GuideBar';
import { SimulationResultSummary } from './SimulationResultSummary';
import { PillButton, Tooltip } from '@/shared/ui';

// Figma node 21:520 / 33:483 (Slide 2·3) — 블록 조립 워크스페이스, 시뮬레이션 통과 전.
//   프로그램에 구조 오류가 있으면(예: '종료' 미연결) '시뮬레이션 하기' 비활성(아웃라인) + 안내문이 오류 메시지.
//   블록은 팔레트/캔버스에서 끌어 옮긴다. 스택 슬롯에 가까우면 스냅 연결, 아니면 놓은 자리에 그대로 둔다.
//   잡은 블록 아래에 연결된 블록은 함께 딸려온다 (기명서 "블록 드래그 이동·스냅 연결").
//   캔버스 위 한 줄 안내 띠(GuideBar)가 단계 안내·오류 안내를 함께 맡는다.

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
  /** 방금 받은 시뮬레이션 결과 — 실패했으면 안내 띠 아래에 결과 카드·실행순서를 보여준다. */
  result?: SimulationResult;
  guideStep?: GuideStep;
  guideCollapsed?: boolean;
  onToggleGuide?: () => void;
  /** 미션 모드 — 안내 띠에 목표와 힌트를 보여준다. */
  mission?: { goal: string; composition?: string };
  /** 첫 진입 끌어오기 손가락 애니메이션을 보여줄지 */
  showDragHint?: boolean;
  onDragHintDone?: () => void;
};

export function BlockWorkspace({
  program,
  errors,
  onBlockParamChange,
  onSimulate,
  simulating = false,
  simulationMessage,
  result,
  guideStep = 1,
  guideCollapsed = false,
  onToggleGuide,
  mission,
  showDragHint = false,
  onDragHintDone,
}: BlockWorkspaceProps) {
  const { dragging, startDrag, registerStack, registerCanvas, registerTrash } = useBlockDrag();

  const valid = errors.length === 0;
  const alert = simulationMessage ?? errors[0]?.message;
  const dimIds = dragging?.active ? new Set(dragging.carried.map((b) => b.id)) : undefined;

  // 처음 블록을 끌기 시작하면 끌어오기 안내 손가락을 끝낸다.
  const dragActive = dragging?.active ?? false;
  useEffect(() => {
    if (dragActive && showDragHint) onDragHintDone?.();
  }, [dragActive, showDragHint, onDragHintDone]);

  return (
    <section className="bg-page flex flex-1 flex-col" aria-label="블록 워크스페이스">
      {/* 안내 띠(단계 안내 / 오류 / 미션 목표) + 실행 버튼. */}
      <div className="flex items-start justify-between gap-4 px-8 py-1">
        <GuideBar
          step={guideStep}
          alert={alert}
          collapsed={guideCollapsed}
          onToggle={() => onToggleGuide?.()}
          mission={mission}
        />
        {/* primary(상하 12)가 잠김 버튼(상하 11)보다 살짝 커서 center 정렬 (Figma Frame 17). */}
        <div className="flex min-h-12 shrink-0 items-center gap-2">
          {valid ? (
            <PillButton variant="primary" onClick={onSimulate}>
              {simulating ? '시뮬레이션 중…' : '시뮬레이션 하기'}
            </PillButton>
          ) : (
            // 구조 오류가 있으면 시뮬레이션을 막는다 (명세 Simulation)
            <PillButton aria-disabled>시뮬레이션 하기</PillButton>
          )}
          {/* 시뮬레이션 통과 기록이 없어 잠김 (명세 Execution) */}
          <Tooltip text="시뮬레이션을 통과하면 열려요">
            <PillButton aria-disabled title="시뮬레이션을 통과하면 열려요">
              로봇 실행하기<span className="text-[13px]">• 잠김</span>
            </PillButton>
          </Tooltip>
        </div>
      </div>

      {/* 방금 시뮬레이션이 실패했으면 결과 카드·실행순서 (Figma Slide 6). 편집하면 사라진다. */}
      {result && !result.passed && (
        <div className="border-line bg-card max-h-[258px] overflow-y-auto border-t-[1.5px] px-8 py-[18px]">
          <SimulationResultSummary result={result} />
        </div>
      )}

      {/* 블록 조립 캔버스 (Rectangle 7). */}
      <div
        ref={registerCanvas}
        data-block-canvas
        className="border-line bg-card dot-grid relative min-h-[453px] flex-1 border-t-[1.5px]"
        role="region"
        aria-label="블록 조립 캔버스"
      >
        {showDragHint && <DragHint onDone={() => onDragHintDone?.()} />}
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

        {/* 쓰레기통 (기명서 "블록 삭제") — 화면 오른쪽 구석에 고정. 드래그 중인 블록이
            시각 영역 바깥 30px 감지 영역에 들어오면 뚜껑 열린 모양으로 강조한다. */}
        <div
          ref={registerTrash}
          data-trash
          aria-hidden
          className={`absolute right-6 bottom-6 size-16 transition-transform ${
            dragging?.overTrash ? 'scale-110' : ''
          }`}
        >
          {dragging?.overTrash ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/experience/trash-open-body.svg"
                alt=""
                className="absolute bottom-0 h-[61px] w-16"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/experience/trash-open-lid.svg"
                alt=""
                className="absolute -top-2 left-1 h-[19px] w-16 -rotate-[35deg]"
              />
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/experience/trash-closed.svg" alt="블록 삭제" className="size-full" />
          )}
        </div>
      </div>
    </section>
  );
}
