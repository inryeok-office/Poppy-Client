'use client';

import { useEffect, useRef, useState } from 'react';

import { AssembledBlockWorkspace } from './AssembledBlockWorkspace';
import { BlockPalette } from './BlockPalette';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';
import { RunReadyWorkspace } from './RunReadyWorkspace';

/**
 * 블록 코딩 체험 화면 (Figma "뽀삐" node 21:520 / Slide 3·4).
 *
 * 명세(Simulation·Execution) 기준 상태 흐름:
 *   1. 블록 구조가 유효하면 '시뮬레이션 하기' 활성 (지금은 고정 데모 프로그램이라 항상 유효)
 *   2. 시뮬레이션 통과 기록이 있어야 '로봇 실행하기' 활성 — 없으면 잠김
 *   3. 통과 후 튜토리얼 패널이 사라지고 캔버스가 커진다 (Slide 3 → Slide 4)
 * 헤더 '전체 지우기' / '처음으로' 는 통과 기록을 초기화한다 (명세: 블록·모드 변경 시 기록 무효화).
 *
 * 백엔드가 없어 시뮬레이션 판정은 mock (setTimeout). 후속 조각에서 MSW mock API 로 교체.
 */
type SimulationStatus = 'idle' | 'running' | 'passed';

const MOCK_SIMULATION_MS = 700;

export function ExperienceView() {
  const [simulation, setSimulation] = useState<SimulationStatus>('idle');
  const simulationTimer = useRef<number | null>(null);

  const cancelPendingSimulation = () => {
    if (simulationTimer.current !== null) {
      window.clearTimeout(simulationTimer.current);
      simulationTimer.current = null;
    }
  };

  // 언마운트 시 대기 중인 mock 타이머 정리
  useEffect(() => cancelPendingSimulation, []);

  const runSimulation = () => {
    if (simulation === 'running') return;
    setSimulation('running');
    cancelPendingSimulation();
    // TODO(조각 3): 서버가 블록 구조·안전 제한을 검증하고 통과 기록을 발급 (명세 Simulation)
    simulationTimer.current = window.setTimeout(() => {
      simulationTimer.current = null;
      setSimulation('passed');
    }, MOCK_SIMULATION_MS);
  };

  const resetSession = () => {
    // 검증 중 초기화하면 대기 중인 타이머가 뒤늦게 'passed' 로 되돌리지 않도록 취소
    cancelPendingSimulation();
    setSimulation('idle');
  };

  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader onClearAll={resetSession} onRestart={resetSession} />
      <div className="flex flex-1">
        <BlockPalette />
        {simulation === 'passed' ? (
          <RunReadyWorkspace onSimulate={runSimulation} />
        ) : (
          <AssembledBlockWorkspace
            onSimulate={runSimulation}
            simulating={simulation === 'running'}
          />
        )}
        <RobotPreview />
      </div>
    </div>
  );
}
