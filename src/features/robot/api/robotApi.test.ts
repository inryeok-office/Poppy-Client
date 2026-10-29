import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import { robotBadgeKind, type RobotAvailability } from '../model/types';
import { ROBOT_AVAILABILITY_POLL_MS } from './hooks';
import { MOCK_ROBOT_AVAILABILITY } from './mocks';
import { getRobotAvailability } from './robotApi';

function availability(
  ...statuses: RobotAvailability['robots'][number]['status'][]
): RobotAvailability {
  return {
    availableCount: statuses.filter((status) => status === 'READY').length,
    total: statuses.length,
    robots: statuses.map((status, index) => ({ alias: `GO2EDU00${index + 1}`, status })),
  };
}

describe('getRobotAvailability', () => {
  it('Server 응답의 data 를 그대로 돌려준다', async () => {
    await expect(getRobotAvailability()).resolves.toEqual(MOCK_ROBOT_AVAILABILITY);
  });

  it('API 가 없는 Server(404)면 null — 배지를 숨긴다', async () => {
    server.use(
      http.get('*/api/v1/robots/availability', () =>
        HttpResponse.json(
          { success: false, data: null, error: { code: 'COMMON_404', message: 'not found' } },
          { status: 404 },
        ),
      ),
    );

    await expect(getRobotAvailability()).resolves.toBeNull();
  });

  it('그 밖의 오류는 그대로 던진다', async () => {
    server.use(
      http.get('*/api/v1/robots/availability', () =>
        HttpResponse.json({ success: false, data: null, error: null }, { status: 500 }),
      ),
    );

    await expect(getRobotAvailability()).rejects.toMatchObject({ status: 500 });
  });

  it('10초마다 다시 묻는다', () => {
    expect(ROBOT_AVAILABILITY_POLL_MS).toBe(10_000);
  });
});

describe('robotBadgeKind', () => {
  it('한 대라도 READY 면 준비됨', () => {
    expect(robotBadgeKind(availability('OFFLINE', 'READY'))).toBe('ready');
  });

  it('READY 가 없고 BUSY 가 있으면 사용 중', () => {
    expect(robotBadgeKind(availability('BUSY', 'OFFLINE'))).toBe('busy');
  });

  it('OFFLINE·UNAVAILABLE 뿐이거나 0대면 연결 안 됨', () => {
    expect(robotBadgeKind(availability('OFFLINE', 'UNAVAILABLE'))).toBe('offline');
    expect(robotBadgeKind(availability())).toBe('offline');
  });
});
