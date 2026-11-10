import { ApiError, api, type ApiResponse } from '@/shared/api';

import type { RobotAvailability } from '../model/types';

/**
 * 아직 이 API 가 없는 Server(404)뿐 아니라, 운영에서 간헐적으로 보는 500 등 어떤 오류든
 * null — 배지를 조용히 숨긴다(행사 회고: 로봇 가용 상태 API가 500을 준 적이 있다).
 * 10초 폴링(useRobotAvailability)이 재시도 없이도 다음 주기에 다시 물어보므로, 여기서
 * 오류를 숨겨도 복구되면 곧바로 배지가 돌아온다. 에러를 던지지 않아 재시도 폭주나
 * 콘솔 에러 반복도 생기지 않는다.
 */
export async function getRobotAvailability(): Promise<RobotAvailability | null> {
  try {
    const response = await api.get<ApiResponse<RobotAvailability>>('/api/v1/robots/availability');
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiError) return null;
    throw error;
  }
}
