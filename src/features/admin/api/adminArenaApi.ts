import { ApiError, api, type ApiResponse } from '@/shared/api';
import type { ArenaSettingsResponse } from '@/features/simulation';

// 관리자 인증은 Server 의 세션 쿠키(POPPY_ADMIN_SESSION, Path=/api/v1/admin) + CSRF 헤더 방식이다
// (Poppy-Server docs/contracts/admin-auth-api.md). 브라우저가 쿠키를 자동으로 보내므로 여기서는
// 토큰을 저장하지 않는다. PIN 은 Server 관리자 계정의 비밀번호다.

/** 관리자 아이디. PIN 만 입력받고 아이디는 배포 설정으로 고정한다. */
export const ADMIN_USERNAME = process.env.NEXT_PUBLIC_ADMIN_USERNAME || 'admin';

export type ArenaPresetCode = '6x6-박람회' | '3x3-부스';

export type CurrentArenaSettings = ArenaSettingsResponse & { updatedAt: string | null };

export async function loginAdmin(pin: string): Promise<void> {
  await api.post('/api/v1/admin/auth/login', { username: ADMIN_USERNAME, password: pin });
}

/** 관리자 세션이 살아 있는지 — 401 이면 false. 다른 오류는 그대로 던진다. */
export async function hasAdminSession(): Promise<boolean> {
  try {
    await api.get('/api/v1/admin/arena-settings/history');
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return false;
    throw error;
  }
}

export async function fetchArenaSettings(): Promise<CurrentArenaSettings> {
  const response = await api.get<ApiResponse<CurrentArenaSettings>>('/api/v1/arena-settings');
  return response.data.data;
}

async function csrfHeader(): Promise<Record<string, string>> {
  const response =
    await api.get<ApiResponse<{ headerName: string; token: string }>>('/api/v1/admin/auth/csrf');
  const { headerName, token } = response.data.data;
  return { [headerName]: token };
}

export async function applyArenaPreset(presetCode: ArenaPresetCode): Promise<CurrentArenaSettings> {
  const headers = await csrfHeader();
  const response = await api.put<ApiResponse<CurrentArenaSettings>>(
    '/api/v1/admin/arena-settings',
    { presetCode },
    { headers },
  );
  return response.data.data;
}
