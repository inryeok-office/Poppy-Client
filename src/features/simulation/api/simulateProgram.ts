import { api, sessionAuthHeaders, type ApiResponse } from '@/shared/api';
import { sumOverBlockTree } from '@/shared/lib/blockTree';

import { ARENA, MAX_TOTAL_SECONDS, type MotionViolationCode } from '../model/motionPlan';
import { buildSimulationSteps, evaluateProgram } from '../model/safety';
import type { SerializedBlockNode, SimulationRequest, SimulationResult } from '../model/types';

function countCommands(nodes: SerializedBlockNode[]): number {
  return sumOverBlockTree(nodes, {
    valueOf: () => 1,
    bodyOf: (node) => (node.kind === 'repeat' ? node.body : undefined),
    repeatCountOf: () => 1,
  });
}

/** 실행 규칙 위반 안내 (Agent controlled_motion_open 과 같은 규칙). */
const violationMessage = (code: MotionViolationCode, index: number): string => {
  switch (code) {
    case 'exceeds-safe-zone':
      return `${index + 1}번째 블록에서 안전 구역(${ARENA.widthM}m×${ARENA.depthM}m) 밖으로 나가요. 거리를 줄이거나 방향을 바꿔 주세요.`;
    case 'exceeds-time':
      return `동작 시간이 너무 길어요. 한 번에 ${MAX_TOTAL_SECONDS}초까지 움직일 수 있어요. 블록이나 반복 횟수를 줄여주세요.`;
    case 'moves-while-sitting':
      return '앉은 상태에서는 움직일 수 없어요. 먼저 ‘일어서기’ 블록을 넣어 주세요.';
  }
};

export async function simulateProgram(request: SimulationRequest): Promise<SimulationResult> {
  const evaluation = evaluateProgram(request.program);
  const violations = !evaluation.valuesValid
    ? [{ code: 'invalid-values' as const, message: '블록 값이 올바르지 않아요.' }]
    : evaluation.violation
      ? [
          {
            code: evaluation.violation,
            message: violationMessage(evaluation.violation, evaluation.violationIndex ?? 0),
          },
        ]
      : [];
  const steps =
    evaluation.structurallyValid && evaluation.valuesValid
      ? buildSimulationSteps(request.program.chain)
      : [];
  return {
    passed: evaluation.runnable,
    normalizedCommandCount: countCommands(request.program.chain),
    totalDistanceM: evaluation.totalDistanceM,
    violations,
    notes: [],
    steps,
  };
}

export async function recordSimulationPass(
  sessionId: string,
  blockVersion: number,
): Promise<{ sessionId: string; blockVersion: number; passedAt: string }> {
  const response = await api.post<
    ApiResponse<{ sessionId: string; blockVersion: number; passedAt: string }>
  >(
    `/api/v1/sessions/${sessionId}/simulation-passes`,
    { blockVersion },
    { headers: sessionAuthHeaders(sessionId) },
  );
  return response.data.data;
}
