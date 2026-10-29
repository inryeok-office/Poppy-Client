import { HttpResponse, http } from 'msw';

import type { RobotAvailability } from '../model/types';

export const MOCK_ROBOT_AVAILABILITY: RobotAvailability = {
  availableCount: 1,
  total: 1,
  robots: [{ alias: 'GO2EDU001', status: 'READY' }],
};

export const robotHandlers = [
  http.get('*/api/v1/robots/availability', () =>
    HttpResponse.json({ success: true, data: MOCK_ROBOT_AVAILABILITY, error: null }),
  ),
];
