import { HttpResponse, delay, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import type { SafetyViolation, SimulationRequest, SimulationResult } from '../model/types';

// 백엔드(Poppy-Server) 전 임시 mock.
//   - 구조 검증: 떨어진 블록이 없고 '종료' 로 끝나야 한다
//   - 값 검증: 클라이언트를 신뢰하지 않고 서버가 직접 범위를 확인한다 (명세: "서버 정책이 클라이언트보다 우선")
//   - 안전 제한: 총 이동 거리가 2m 안전 구역을 넘으면 안 된다 (명세 Simulation "안전 제한 검증")
// 속도·회전각·총 시간 상한, 장비별 프로필은 후속.
const MOCK_LATENCY_MS = 500;
const SAFE_ZONE_M = 2;
const SERVER_LIMITS = {
  repeatCount: { min: 1, max: 20 },
  moveDistance: { min: 1, max: 10 },
} as const;

const inRange = (raw: unknown, { min, max }: { min: number; max: number }) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max;
};

// `*/` prefix — axios baseURL(상대 '' / 프록시 절대 URL)이 무엇이든 매칭되게 한다.
export const simulationHandlers = [
  http.post('*/api/simulations', async ({ request }) => {
    const { program } = (await request.json()) as SimulationRequest;
    await delay(MOCK_LATENCY_MS);

    const valuesValid =
      inRange(program.repeatCount, SERVER_LIMITS.repeatCount) &&
      inRange(program.moveDistance, SERVER_LIMITS.moveDistance);
    const totalDistanceM = valuesValid ? program.repeatCount * program.moveDistance : 0;
    const structurallyValid = program.detached.length === 0 && program.chain.at(-1) === 'end';

    const violations: SafetyViolation[] = [];
    if (!valuesValid) {
      violations.push({
        code: 'invalid-values',
        message: '블록 값이 허용 범위를 벗어났어요. 반복 횟수와 이동 거리를 다시 확인해 주세요.',
      });
    } else if (totalDistanceM > SAFE_ZONE_M) {
      violations.push({
        code: 'exceeds-safe-zone',
        message: `로봇이 ${SAFE_ZONE_M}m 안전 구역을 벗어나요. 반복 횟수나 이동 거리를 줄여 주세요.`,
      });
    }

    const passed = structurallyValid && violations.length === 0;

    const result: SimulationResult = {
      passed,
      normalizedCommandCount: program.chain.length,
      totalDistanceM,
      violations,
      notes: passed ? ['실제 물리 결과와 차이가 있을 수 있어요.'] : [],
    };

    return HttpResponse.json<ApiResponse<SimulationResult>>({ success: true, data: result });
  }),
];
