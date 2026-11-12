import { api, type ApiResponse } from '@/shared/api';

import { arenaFromResponse, DEFAULT_ARENA, type ArenaConfig } from '../model/arena';

/**
 * 체험 공간 조회. 어떤 오류(404·500·네트워크)든, 응답 값이 이상하든 6×6 기본값을 돌려준다 —
 * 설정을 못 받는 상황이 행사를 멈추면 안 되고, 기본값은 지금까지의 동작과 같다.
 */
export async function getArenaConfig(): Promise<ArenaConfig> {
  try {
    const response = await api.get<ApiResponse<unknown>>('/api/v1/arena-settings');
    return arenaFromResponse(response.data.data) ?? DEFAULT_ARENA;
  } catch {
    return DEFAULT_ARENA;
  }
}
