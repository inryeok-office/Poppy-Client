import { api, sessionAuthHeaders, type ApiResponse } from '@/shared/api';
import { sumOverBlockTree } from '@/shared/lib/blockTree';

import { MAX_TOTAL_SECONDS, type MotionViolationCode } from '../model/motionPlan';
import { buildSimulationSteps, evaluateProgram, SAFE_ZONE_M } from '../model/safety';
import type { SerializedBlockNode, SimulationRequest, SimulationResult } from '../model/types';

function countCommands(nodes: SerializedBlockNode[]): number {
  return sumOverBlockTree(nodes, {
    valueOf: () => 1,
    bodyOf: (node) => (node.kind === 'repeat' ? node.body : undefined),
    repeatCountOf: () => 1,
  });
}

/** 실행 규칙 위반 안내 (Agent controlled_motion_open 과 같은 규칙). */
const VIOLATION_MESSAGE: Record<MotionViolationCode, string> = {
  'exceeds-safe-zone': `안전 구역을 벗어나요. 한 번에 움직일 수 있는 거리는 ${SAFE_ZONE_M}m예요. 이동 거리를 줄여주세요.`,
  'exceeds-time': `동작 시간이 너무 길어요. 한 번에 ${MAX_TOTAL_SECONDS}초까지 움직일 수 있어요. 블록이나 반복 횟수를 줄여주세요.`,
  'moves-while-sitting': '앉은 상태에서는 움직일 수 없어요. 먼저 ‘일어서기’ 블록을 넣어 주세요.',
};

export async function simulateProgram(request: SimulationRequest): Promise<SimulationResult> {
  const evaluation = evaluateProgram(request.program);
  const violations = !evaluation.valuesValid
    ? [{ code: 'invalid-values' as const, message: '블록 값이 올바르지 않아요.' }]
    : evaluation.violation
      ? [{ code: evaluation.violation, message: VIOLATION_MESSAGE[evaluation.violation] }]
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
