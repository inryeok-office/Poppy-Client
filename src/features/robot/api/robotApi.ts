import { ApiError, api, type ApiResponse } from '@/shared/api';

import type { RobotAvailability } from '../model/types';

/** 아직 이 API 가 없는 Server(404)에서는 null — 배지를 숨긴다. */
export async function getRobotAvailability(): Promise<RobotAvailability | null> {
  try {
    const response = await api.get<ApiResponse<RobotAvailability>>('/api/v1/robots/availability');
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
