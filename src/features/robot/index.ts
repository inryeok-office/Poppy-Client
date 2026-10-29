export { getRobotAvailability } from './api/robotApi';
export { ROBOT_AVAILABILITY_POLL_MS, useRobotAvailability } from './api/hooks';
export { MOCK_ROBOT_AVAILABILITY, robotHandlers } from './api/mocks';
export {
  ROBOT_BADGE_LABEL,
  robotBadgeKind,
  type RobotAvailability,
  type RobotAvailabilityStatus,
  type RobotBadgeKind,
} from './model/types';
