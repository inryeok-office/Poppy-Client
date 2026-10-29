import { useEffect, useState } from 'react';

import {
  isCancellableStatus,
  isTerminalStatus,
  type ExecutionStatus,
  type MissionResult,
} from '@/features/execution';
import type { RobotBadgeKind } from '@/features/robot';
import { UNKNOWN_ERROR_MESSAGE } from '@/shared/api';
import type { SimulationResult } from '@/features/simulation';

import { useBlockDrag } from '../lib/useBlockDrag';
import { GUIDE_TEXT } from '../model/guide';
import type { BlockProgram } from '../model/blockProgram';
import { BlockStack } from './BlockStack';
import { MissionResultCard } from './MissionResultCard';
import { ROBOT_NOT_READY_HINT, RobotBadge } from './RobotBadge';
import { SimulationResultSummary } from './SimulationResultSummary';
import { PillButton } from '@/shared/ui';

// Figma node 33:700 (Slide 16:9 - 4) — 조립 완료 + 시뮬레이션 통과.
// 로봇 실행을 요청하면 이 상단 행이 실행 상태(대기·배정·진행·완료)를 보여준다 (명세 Execution).
// 헤더 아래(y205) ~ 캔버스 상단(y257) 사이 52px 가 이 상단 행. 버튼 40 · 상하 6.
//
// 이 화면에서는 블록을 편집하지 않지만(program 은 읽기 전용으로만 그린다), 캔버스 ref 는
// 그대로 등록해둔다 — BlockWorkspace 에서 시작한 드래그가 시뮬레이션 통과로 이 화면으로
// 바뀌는 순간에도 걸쳐 있을 수 있는데, 그때 registerCanvas 가 없으면 드롭 좌표를 잴 곳이
// 없어 드래그하던 블록이 아무 데도 못 붙고 조용히 사라진다.

// 시뮬레이션을 통과한 화면 — 안내 띠 4/4 단계 문구 (GuideBar 와 같은 문구).
const DEFAULT_HINT = `4/4 · ${GUIDE_TEXT[4]}`;

/** 이 시간 넘게 QUEUED 면 로봇이 아직 준비 안 됐다고 안내하고 취소를 강조한다. */
export const QUEUED_TOO_LONG_MS = 15_000;
const QUEUED_TOO_LONG_HINT =
  '로봇이 아직 준비되지 않았어요. 조금 더 기다리거나 실행을 취소해 주세요.';

const EXECUTION_HINT: Record<ExecutionStatus, string> = {
  queued: '실행을 기다리고 있어요…',
  assigned: '로봇에 배정됐어요.',
  running: '로봇이 움직이는 중이에요. 멈춰야 하면 진행요원에게 말해 주세요.',
  completed: '완료했어요! 🎉',
  failed: UNKNOWN_ERROR_MESSAGE,
  cancelled: '실행을 멈췄어요.',
};

type RunReadyWorkspaceProps = {
  program: BlockProgram;
  /** 실행 요청(POST) 중 — 아직 실행 ID 를 못 받은 상태 */
  requesting?: boolean;
  /** 실행이 시작됐으면 현재 상태, 아니면 null */
  executionStatus?: ExecutionStatus | null;
  /** 완료·실패 시 서버가 준 메시지 */
  executionMessage?: string | null;
  /** 실행 요청·취소가 실패한 이유 (서버 오류 코드 → 한국어) */
  errorMessage?: string | null;
  onSimulate?: () => void;
  onRun?: () => void;
  onStop?: () => void;
  /** 실행이 끝난 뒤 '다음 체험자 시작' — 기록을 지우고 첫 화면으로 */
  onNextVisitor?: () => void;
  /** 방금 받은 시뮬레이션 결과 — 아직 실행을 시작하기 전(executionStatus 없음)에만 보여준다. */
  result?: SimulationResult;
  /** 미션 실행이 완료됐을 때 Server 판정 결과 (없으면 카드 없음). */
  missionResult?: MissionResult | null;
  /** 로봇 가용 상태 배지 — null 이면(API 없음·조회 실패) 숨긴다. */
  robotBadge?: RobotBadgeKind | null;
};

export function RunReadyWorkspace({
  program,
  requesting = false,
  executionStatus = null,
  executionMessage,
  errorMessage,
  onSimulate,
  onRun,
  onStop,
  onNextVisitor,
  result,
  missionResult = null,
  robotBadge = null,
}: RunReadyWorkspaceProps) {
  const { registerCanvas, registerStack } = useBlockDrag();
  // QUEUED 가 오래 이어지는지 — 상태가 바뀌면 다시 센다.
  const [queuedTooLong, setQueuedTooLong] = useState(false);
  useEffect(() => {
    if (executionStatus !== 'queued') return;
    const timer = window.setTimeout(() => setQueuedTooLong(true), QUEUED_TOO_LONG_MS);
    return () => {
      window.clearTimeout(timer);
      setQueuedTooLong(false);
    };
  }, [executionStatus]);
  const inProgress =
    executionStatus === 'queued' || executionStatus === 'assigned' || executionStatus === 'running';
  // 명세: 체험자는 QUEUED·ASSIGNED 에서만 취소할 수 있다. RUNNING 이후 중지는 관리자 기능.
  const cancellable = isCancellableStatus(executionStatus ?? undefined);
  const busy = requesting || inProgress;
  const showRunButton = !requesting && !cancellable && executionStatus === null;
  const robotNotReadyHint =
    showRunButton && robotBadge !== null && robotBadge !== 'ready'
      ? ROBOT_NOT_READY_HINT[robotBadge]
      : null;
  const hint = requesting
    ? '실행을 요청하고 있어요…'
    : errorMessage
      ? errorMessage
      : executionStatus === 'queued' && queuedTooLong
        ? QUEUED_TOO_LONG_HINT
        : executionStatus
          ? (executionMessage ?? EXECUTION_HINT[executionStatus])
          : DEFAULT_HINT;

  return (
    <section className="bg-page flex flex-1 flex-col" aria-label="블록 워크스페이스">
      {/* 안내문(실행 상태) + 실행 버튼 (Frame 8 · Frame 17). */}
      <div className="flex items-center justify-between px-8 py-[6px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]" aria-live="polite">
          <span aria-hidden className="bg-block-start size-3 rounded-full" />
          {hint}
        </p>
        <div className="flex items-center gap-2">
          {robotBadge && <RobotBadge kind={robotBadge} />}
          {robotNotReadyHint && (
            <span
              data-testid="robot-not-ready"
              className="text-muted text-[12px]"
              aria-live="polite"
            >
              {robotNotReadyHint}
            </span>
          )}
          {!busy && executionStatus !== 'completed' && (
            <PillButton variant="primary" onClick={onSimulate}>
              시뮬레이션 하기
            </PillButton>
          )}
          {requesting ? (
            <PillButton aria-disabled>요청 중…</PillButton>
          ) : cancellable ? (
            <PillButton
              variant="primary"
              onClick={onStop}
              className={
                executionStatus === 'queued' && queuedTooLong
                  ? 'ring-danger animate-pulse ring-2 ring-offset-2'
                  : ''
              }
            >
              {executionStatus === 'queued' && queuedTooLong ? '실행 취소하기' : '실행 중지'}
            </PillButton>
          ) : executionStatus === 'running' ? (
            // 명세: RUNNING 이후 중지는 관리자 기능 — 체험자 화면엔 중지 버튼을 보여주지 않는다.
            <PillButton aria-disabled>실행 중…</PillButton>
          ) : executionStatus === 'completed' ? (
            <PillButton aria-disabled>완료</PillButton>
          ) : (
            <PillButton variant="primary" onClick={onRun}>
              로봇 실행하기
            </PillButton>
          )}
          {/* 실행이 끝났으면(완료·실패·취소) 다음 체험자를 위해 기록을 지우고 첫 화면으로 */}
          {isTerminalStatus(executionStatus ?? undefined) && onNextVisitor && (
            <PillButton onClick={onNextVisitor}>다음 체험자 시작</PillButton>
          )}
        </div>
      </div>

      {/* 방금 통과한 시뮬레이션 결과(카드·실행순서) — 실행을 시작하면(executionStatus 생김) 사라진다
          (Figma Slide 7). '실행 블록' 목록은 바로 아래 캔버스가 이미 읽기 전용으로 보여주고 있다. */}
      {executionStatus === 'completed' && missionResult && (
        <div className="border-line bg-card border-b-[1.5px] px-8 py-4">
          <MissionResultCard result={missionResult} />
        </div>
      )}

      {result?.passed && !executionStatus && (
        <div className="border-line bg-card border-b-[1.5px] px-8 py-4">
          <SimulationResultSummary result={result} />
        </div>
      )}

      {/* 조립 캔버스 (Rectangle 7, h763). 완성된 프로그램. 블록은 캔버스 좌상단 기준 x63 y67. */}
      <div
        ref={registerCanvas}
        className="border-line bg-card dot-grid relative min-h-[763px] flex-1 border-t-[1.5px]"
        role="region"
        aria-label="블록 조립 캔버스"
      >
        <div className="absolute top-[67px] left-[63px]">
          <BlockStack nodes={program.stack} containerRef={registerStack} />
        </div>
      </div>
    </section>
  );
}
