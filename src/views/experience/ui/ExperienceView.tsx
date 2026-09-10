'use client';

import { useMemo, useState } from 'react';

import { useCancelExecution, useExecutionState, useRequestExecution } from '@/features/execution';
import { useSimulateProgram } from '@/features/simulation';

import {
  INITIAL_PROGRAM,
  connectDetachedBlocks,
  validateBlockProgram,
  type BlockProgram,
} from '../model/blockProgram';
import { BlockPalette } from './BlockPalette';
import { BlockWorkspace } from './BlockWorkspace';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';
import { RunReadyWorkspace } from './RunReadyWorkspace';

/**
 * 블록 코딩 체험 화면 (Figma "뽀삐" node 21:520 / Slide 2·3·4).
 *
 * 명세(Mission & Block · Simulation · Execution) 기준 상태 흐름:
 *   1. 블록 구조 검증 — 오류가 있으면 '시뮬레이션 하기' 비활성 (떨어진 '종료' 연결 필요)
 *   2. 구조·값·안전 제한(이동 거리)을 모두 통과해야 시뮬레이션 통과 기록 발급
 *   3. 통과 기록이 있어야 '로봇 실행하기' 활성 — 없으면 잠김
 *   4. '로봇 실행하기' → 실행 요청 → 대기·배정·진행·완료 상태를 안내문에 표시 (실행 중지 가능)
 * 블록 값을 바꾸거나 '전체 지우기'/'처음으로' 를 누르면 통과 기록·실행을 초기화한다
 * (명세: "블록·모드·미션·안전 정책 변경 시 기록을 무효화").
 *
 * 시뮬레이션·실행은 features/{simulation,execution} 의 mock API(MSW). 실제 백엔드가 생기면 핸들러만 걷어낸다.
 */
export function ExperienceView() {
  const [program, setProgram] = useState<BlockProgram>(INITIAL_PROGRAM);
  const [executionId, setExecutionId] = useState<string | null>(null);

  const simulation = useSimulateProgram();
  const requestExecution = useRequestExecution();
  const cancelExecution = useCancelExecution();
  const execution = useExecutionState(executionId);

  const blockErrors = useMemo(() => validateBlockProgram(program), [program]);
  const blockValid = blockErrors.length === 0;

  const simulationResult = simulation.data;
  const simulationPassed = simulationResult?.passed === true;
  const simulationMessage = simulation.isError
    ? '시뮬레이션에 실패했어요. 잠시 후 다시 시도해 주세요.'
    : simulationResult && !simulationResult.passed
      ? simulationResult.violations[0]?.message
      : undefined;
  const estimatedDistanceM = simulationResult?.totalDistanceM ?? 0;

  const executionStatus = execution.data?.status ?? (requestExecution.isPending ? 'queued' : null);
  const executionMessage = execution.data?.message ?? null;

  const clearExecution = () => {
    setExecutionId(null);
    requestExecution.reset();
    cancelExecution.reset();
  };

  const invalidate = () => {
    simulation.reset();
    clearExecution();
  };

  const runSimulation = () => {
    if (simulation.isPending || !blockValid) return;
    simulation.mutate({ program });
  };

  const requestRun = () => {
    if (!simulationPassed || executionId !== null || requestExecution.isPending) return;
    requestExecution.mutate({ program }, { onSuccess: (data) => setExecutionId(data.executionId) });
  };

  const stopRun = () => {
    if (executionId === null) return;
    cancelExecution.mutate(executionId, { onSuccess: () => void execution.refetch() });
  };

  const editProgram = (patch: Partial<BlockProgram>) => {
    setProgram((current) => ({ ...current, ...patch }));
    invalidate();
  };

  const connectBlock = () => {
    setProgram(connectDetachedBlocks);
    invalidate();
  };

  const resetSession = () => {
    setProgram(INITIAL_PROGRAM);
    invalidate();
  };

  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader onClearAll={resetSession} onRestart={resetSession} />
      <div className="flex flex-1">
        <BlockPalette />
        {simulationPassed ? (
          <RunReadyWorkspace
            program={program}
            executionStatus={executionStatus}
            executionMessage={executionMessage}
            onSimulate={runSimulation}
            onRun={requestRun}
            onStop={stopRun}
          />
        ) : (
          <BlockWorkspace
            program={program}
            errors={blockErrors}
            onConnectBlock={connectBlock}
            onRepeatCountChange={(repeatCount) => editProgram({ repeatCount })}
            onMoveDistanceChange={(moveDistance) => editProgram({ moveDistance })}
            onSimulate={runSimulation}
            simulating={simulation.isPending}
            simulationMessage={simulationMessage}
          />
        )}
        <RobotPreview estimatedDistanceM={estimatedDistanceM} />
      </div>
    </div>
  );
}
