'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

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
 *   2. 구조가 유효하면 시뮬레이션 가능 → 통과하면 통과 기록 발급
 *   3. 통과 기록이 있어야 '로봇 실행하기' 활성 — 없으면 잠김
 *   4. 통과 후 튜토리얼 패널이 사라지고 캔버스가 커진다 (Slide 3 → Slide 4)
 * 헤더 '전체 지우기' / '처음으로' 는 블록·통과 기록을 초기화한다 (명세: 블록 변경 시 기록 무효화).
 *
 * 백엔드가 없어 시뮬레이션 판정은 mock (setTimeout). 후속 조각에서 MSW mock API 로 교체.
 */
type SimulationStatus = 'idle' | 'running' | 'passed';

const MOCK_SIMULATION_MS = 700;

export function ExperienceView() {
  const [program, setProgram] = useState<BlockProgram>(INITIAL_PROGRAM);
  const [simulation, setSimulation] = useState<SimulationStatus>('idle');
  const simulationTimer = useRef<number | null>(null);

  const blockErrors = useMemo(() => validateBlockProgram(program), [program]);
  const blockValid = blockErrors.length === 0;

  const cancelPendingSimulation = () => {
    if (simulationTimer.current !== null) {
      window.clearTimeout(simulationTimer.current);
      simulationTimer.current = null;
    }
  };

  // 언마운트 시 대기 중인 mock 타이머 정리
  useEffect(() => cancelPendingSimulation, []);

  /** 블록이 바뀌면 통과 기록을 무효화한다 (명세 Simulation "블록 변경 시 기록 무효화"). */
  const invalidateSimulation = () => {
    cancelPendingSimulation();
    setSimulation('idle');
  };

  const connectBlock = () => {
    setProgram(connectDetachedBlocks);
    invalidateSimulation();
  };

  const runSimulation = () => {
    if (simulation === 'running' || !blockValid) return;
    setSimulation('running');
    cancelPendingSimulation();
    // TODO(조각 3): 서버가 블록 구조·안전 제한을 검증하고 통과 기록을 발급 (명세 Simulation)
    simulationTimer.current = window.setTimeout(() => {
      simulationTimer.current = null;
      setSimulation('passed');
    }, MOCK_SIMULATION_MS);
  };

  const resetSession = () => {
    setProgram(INITIAL_PROGRAM);
    invalidateSimulation();
  };

  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader onClearAll={resetSession} onRestart={resetSession} />
      <div className="flex flex-1">
        <BlockPalette />
        {simulation === 'passed' ? (
          <RunReadyWorkspace onSimulate={runSimulation} />
        ) : (
          <BlockWorkspace
            program={program}
            errors={blockErrors}
            onConnectBlock={connectBlock}
            onSimulate={runSimulation}
            simulating={simulation === 'running'}
          />
        )}
        <RobotPreview />
      </div>
    </div>
  );
}
