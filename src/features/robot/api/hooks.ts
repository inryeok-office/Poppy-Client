import { useQuery } from '@tanstack/react-query';

import { getRobotAvailability } from './robotApi';

export const ROBOT_AVAILABILITY_POLL_MS = 10_000;

export function useRobotAvailability(enabled = true) {
  return useQuery({
    queryKey: ['robots', 'availability'],
    queryFn: getRobotAvailability,
    enabled,
    refetchInterval: ROBOT_AVAILABILITY_POLL_MS,
    retry: false,
  });
}
