'use client';

import { useMemo, useState } from 'react';

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
 *   2. 구조가 유효하면 시뮬레이션 실행(mock API) → 통과하면 통과 기록 발급
 *   3. 통과 기록이 있어야 '로봇 실행하기' 활성 — 없으면 잠김
 *   4. 통과 후 튜토리얼 패널이 사라지고 캔버스가 커진다 (Slide 3 → Slide 4)
 * 헤더 '전체 지우기' / '처음으로' 는 블록·통과 기록을 초기화한다 (명세: 블록 변경 시 기록 무효화).
 *
 * 시뮬레이션은 features/simulation 의 mock API(MSW). 실제 백엔드가 생기면 mock 핸들러만 걷어낸다.
 */
export function ExperienceView() {
  const [program, setProgram] = useState<BlockProgram>(INITIAL_PROGRAM);
  const simulation = useSimulateProgram();

  const blockErrors = useMemo(() => validateBlockProgram(program), [program]);
  const blockValid = blockErrors.length === 0;
  const simulationPassed = simulation.data?.passed === true;
  const simulationError = simulation.isError
    ? '시뮬레이션에 실패했어요. 잠시 후 다시 시도해 주세요.'
    : undefined;

  const runSimulation = () => {
    if (simulation.isPending || !blockValid) return;
    simulation.mutate({ program });
  };

  /** 블록이 바뀌면 통과 기록을 무효화한다 (명세 Simulation "블록 변경 시 기록 무효화"). */
  const connectBlock = () => {
    setProgram(connectDetachedBlocks);
    simulation.reset();
  };

  const resetSession = () => {
    setProgram(INITIAL_PROGRAM);
    simulation.reset();
  };

  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader onClearAll={resetSession} onRestart={resetSession} />
      <div className="flex flex-1">
        <BlockPalette />
        {simulationPassed ? (
          <RunReadyWorkspace onSimulate={runSimulation} />
        ) : (
          <BlockWorkspace
            program={program}
            errors={blockErrors}
            onConnectBlock={connectBlock}
            onSimulate={runSimulation}
            simulating={simulation.isPending}
            simulationError={simulationError}
          />
        )}
        <RobotPreview />
      </div>
    </div>
  );
}
