import { HttpResponse, delay, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import { SAFE_ZONE_M, evaluateProgram } from '../model/safety';
import type {
  SafetyViolation,
  SerializedBlockNode,
  SimulationRequest,
  SimulationResult,
} from '../model/types';

// 백엔드(Poppy-Server) 전 임시 mock.
// 구조·값·안전 제한 판정은 model/safety 의 evaluateProgram 을 쓴다 (실행 mock 과 동일 정책).
// 속도·회전각·총 시간 상한, 장비별 프로필은 후속.
const MOCK_LATENCY_MS = 500;

/** 정규화된 명령 수 — 반복 블록의 body 도 구조상 명령으로 센다(반복 횟수만큼 곱하지 않는다). */
function countCommands(nodes: SerializedBlockNode[]): number {
  return nodes.reduce(
    (sum, node) => sum + 1 + (node.kind === 'repeat' ? countCommands(node.body) : 0),
    0,
  );
}

// `*/` prefix — axios baseURL(상대 '' / 프록시 절대 URL)이 무엇이든 매칭되게 한다.
export const simulationHandlers = [
  http.post('*/api/simulations', async ({ request }) => {
    const { program } = (await request.json()) as SimulationRequest;
    await delay(MOCK_LATENCY_MS);

    const evaluation = evaluateProgram(program);

    const violations: SafetyViolation[] = [];
    if (!evaluation.valuesValid) {
      violations.push({
        code: 'invalid-values',
        message: '블록 값이 허용 범위를 벗어났어요. 반복 횟수와 이동 거리를 다시 확인해 주세요.',
      });
    } else if (!evaluation.withinSafeZone) {
      violations.push({
        code: 'exceeds-safe-zone',
        message: `로봇이 ${SAFE_ZONE_M}m 안전 구역을 벗어나요. 반복 횟수나 이동 거리를 줄여 주세요.`,
      });
    }

    const passed = evaluation.structurallyValid && violations.length === 0;

    const result: SimulationResult = {
      passed,
      normalizedCommandCount: countCommands(program.chain),
      totalDistanceM: evaluation.totalDistanceM,
      violations,
      notes: passed ? ['실제 물리 결과와 차이가 있을 수 있어요.'] : [],
    };

    return HttpResponse.json<ApiResponse<SimulationResult>>({ success: true, data: result });
  }),
];
