import { api, type ApiResponse } from '@/shared/api';

import type { MissionDetail, MissionSummary } from '../model/types';

export async function getMissions(): Promise<MissionSummary[]> {
  const response = await api.get<ApiResponse<{ missions: MissionSummary[] }>>('/api/v1/missions');
  return response.data.data.missions;
}

export async function getMission(missionId: string): Promise<MissionDetail> {
  const response = await api.get<ApiResponse<MissionDetail>>(
    `/api/v1/missions/${encodeURIComponent(missionId)}`,
  );
  return response.data.data;
}
