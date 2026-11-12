import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import { DEFAULT_ARENA } from '../model/arena';
import { getArenaConfig } from './arenaApi';

const booth = {
  presetCode: '3x3-부스',
  widthM: 3,
  depthM: 3,
  marginM: 0.5,
  startXM: 2.5,
  startYM: 0.5,
  startHeading: '+Y',
  limits: { usableWidthM: 2, usableDepthM: 2, maxMovePerCommandM: 1.2, defaultMoveDistanceM: 0.5 },
  updatedAt: '2026-11-12T01:00:00Z',
};

const reply = (data: unknown, status = 200) =>
  http.get('*/api/v1/arena-settings', () =>
    HttpResponse.json({ success: status === 200, data, error: null }, { status }),
  );

describe('getArenaConfig — 조회 실패 시 보수적 기본값(6×6)', () => {
  it('Server 가 3×3 을 주면 그 값을 쓴다', async () => {
    server.use(reply(booth));
    const arena = await getArenaConfig();
    expect(arena.widthM).toBe(3);
    expect(arena.maxMovePerCommandM).toBe(1.2);
  });

  it.each([404, 500, 503])('HTTP %i 이면 6×6 기본값', async (status) => {
    server.use(reply(null, status));
    await expect(getArenaConfig()).resolves.toEqual(DEFAULT_ARENA);
  });

  it('네트워크 오류면 6×6 기본값', async () => {
    server.use(http.get('*/api/v1/arena-settings', () => HttpResponse.error()));
    await expect(getArenaConfig()).resolves.toEqual(DEFAULT_ARENA);
  });

  it('이상한 값(예: 8×8)은 받지 않고 6×6 기본값', async () => {
    server.use(reply({ ...booth, widthM: 8, depthM: 8, presetCode: null }));
    await expect(getArenaConfig()).resolves.toEqual(DEFAULT_ARENA);
  });
});
