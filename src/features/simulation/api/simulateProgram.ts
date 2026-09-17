import { api, sessionAuthHeaders, type ApiResponse } from '@/shared/api';
import { sumOverBlockTree } from '@/shared/lib/blockTree';

import { evaluateProgram, SAFE_ZONE_M } from '../model/safety';
import type { SerializedBlockNode, SimulationRequest, SimulationResult } from '../model/types';

function countCommands(nodes: SerializedBlockNode[]): number {
  return sumOverBlockTree(nodes, {
    valueOf: () => 1,
    bodyOf: (node) => (node.kind === 'repeat' ? node.body : undefined),
    repeatCountOf: () => 1,
  });
}

export async function simulateProgram(request: SimulationRequest): Promise<SimulationResult> {
  const evaluation = evaluateProgram(request.program);
  const violations = evaluation.valuesValid
    ? evaluation.withinSafeZone
      ? []
      : [
          {
            code: 'exceeds-safe-zone' as const,
            message: `안전 구역을 벗어나요. 안전 구역은 ${SAFE_ZONE_M}m이에요. 이동 거리를 줄여주세요.`,
          },
        ]
    : [{ code: 'invalid-values' as const, message: '블록 값이 올바르지 않아요.' }];
  return {
    passed: evaluation.runnable,
    normalizedCommandCount: countCommands(request.program.chain),
    totalDistanceM: evaluation.totalDistanceM,
    violations,
    notes: [],
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
