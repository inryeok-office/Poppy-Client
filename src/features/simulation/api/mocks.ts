import { HttpResponse, delay, http } from 'msw';

import type { ApiResponse } from '@/shared/api';

import type { SimulationRequest, SimulationResult } from '../model/types';

// 백엔드(Poppy-Server) 전 임시 mock.
// 구조가 유효한(떨어진 블록이 없고 '종료' 로 끝나는) 프로그램은 통과시킨다.
// 안전 제한 검증(속도·거리·회전각·반복 횟수·총 시간)은 조각 4.
const MOCK_LATENCY_MS = 500;

// `*/` prefix — axios baseURL(상대 '' / 프록시 절대 URL)이 무엇이든 매칭되게 한다.
export const simulationHandlers = [
  http.post('*/api/simulations', async ({ request }) => {
    const { program } = (await request.json()) as SimulationRequest;
    await delay(MOCK_LATENCY_MS);

    const structurallyValid = program.detached.length === 0 && program.chain.at(-1) === 'end';

    const result: SimulationResult = {
      passed: structurallyValid,
      normalizedCommandCount: program.chain.length,
      notes: structurallyValid ? ['실제 물리 결과와 차이가 있을 수 있어요.'] : [],
    };

    return HttpResponse.json<ApiResponse<SimulationResult>>({ success: true, data: result });
  }),
];
