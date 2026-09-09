import { api, type ApiResponse } from '@/shared/api';

import type { SimulationRequest, SimulationResult } from '../model/types';

/**
 * 블록 프로그램을 서버에 보내 시뮬레이션을 실행한다 (명세 Simulation "시뮬레이션 실행").
 * 서버가 구조·안전 제한을 검증하고 정규화된 명령과 통과 결과를 발급한다.
 */
export async function simulateProgram(request: SimulationRequest): Promise<SimulationResult> {
  const response = await api.post<ApiResponse<SimulationResult>>('/api/simulations', request);
  return response.data.data;
}
