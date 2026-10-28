import { useQuery } from '@tanstack/react-query';

import { getMission, getMissions } from './missionApi';

export function useMissions() {
  return useQuery({ queryKey: ['missions'], queryFn: getMissions, staleTime: 5 * 60_000 });
}

export function useMission(missionId: string | null) {
  return useQuery({
    queryKey: ['mission', missionId],
    queryFn: () => getMission(missionId as string),
    enabled: missionId !== null,
    staleTime: 5 * 60_000,
  });
}
