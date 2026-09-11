import type { ExecutionStatus } from '@/features/execution';

import { useBlockDrag } from '../lib/useBlockDrag';
import type { BlockProgram } from '../model/blockProgram';
import { BlockStack } from './BlockStack';
import { PillButton } from '@/shared/ui';

// Figma node 33:700 (Slide 16:9 - 4) — 조립 완료 + 시뮬레이션 통과.
// 로봇 실행을 요청하면 이 상단 행이 실행 상태(대기·배정·진행·완료)를 보여준다 (명세 Execution).
// 헤더 아래(y205) ~ 캔버스 상단(y257) 사이 52px 가 이 상단 행. 버튼 40 · 상하 6.
//
// 이 화면에서는 블록을 편집하지 않지만(program 은 읽기 전용으로만 그린다), 캔버스 ref 는
// 그대로 등록해둔다 — BlockWorkspace 에서 시작한 드래그가 시뮬레이션 통과로 이 화면으로
// 바뀌는 순간에도 걸쳐 있을 수 있는데, 그때 registerCanvas 가 없으면 드롭 좌표를 잴 곳이
// 없어 드래그하던 블록이 아무 데도 못 붙고 조용히 사라진다.

const DEFAULT_HINT = '반드시 ‘종료’ 블록으로 끝내주세요.';

const EXECUTION_HINT: Record<ExecutionStatus, string> = {
  queued: '실행을 기다리고 있어요…',
  assigned: '로봇에 배정됐어요.',
  running: '로봇이 움직이고 있어요…',
  completed: '완료했어요! 🎉',
  failed: '실행에 실패했어요.',
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
  onSimulate?: () => void;
  onRun?: () => void;
  onStop?: () => void;
};

export function RunReadyWorkspace({
  program,
  requesting = false,
  executionStatus = null,
  executionMessage,
  onSimulate,
  onRun,
  onStop,
}: RunReadyWorkspaceProps) {
  const { registerCanvas, registerStack } = useBlockDrag();
  const inProgress =
    executionStatus === 'queued' || executionStatus === 'assigned' || executionStatus === 'running';
  const busy = requesting || inProgress;
  const hint = requesting
    ? '실행을 요청하고 있어요…'
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
          {!busy && executionStatus !== 'completed' && (
            <PillButton variant="primary" onClick={onSimulate}>
              시뮬레이션 하기
            </PillButton>
          )}
          {requesting ? (
            <PillButton aria-disabled>요청 중…</PillButton>
          ) : inProgress ? (
            <PillButton variant="primary" onClick={onStop}>
              실행 중지
            </PillButton>
          ) : executionStatus === 'completed' ? (
            <PillButton aria-disabled>완료</PillButton>
          ) : (
            <PillButton variant="primary" onClick={onRun}>
              로봇 실행하기
            </PillButton>
          )}
        </div>
      </div>

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
