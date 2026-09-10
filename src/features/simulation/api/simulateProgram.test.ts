import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import type { SerializedBlockProgram } from '../model/types';
import { simulateProgram } from './simulateProgram';

const program = (over: Partial<SerializedBlockProgram> = {}): SerializedBlockProgram => ({
  chain: ['start', 'repeat', 'move', 'greet', 'end'],
  detached: [],
  repeatCount: 2,
  moveDistance: 1,
  ...over,
});

describe('simulateProgram (mock API)', () => {
  it('구조가 유효하고 안전 구역 안이면 통과한다', async () => {
    const result = await simulateProgram({ program: program() });

    expect(result.passed).toBe(true);
    expect(result.totalDistanceM).toBe(2);
    expect(result.violations).toEqual([]);
  });

  it("'종료' 로 끝나지 않으면 통과하지 못한다", async () => {
    const result = await simulateProgram({
      program: program({ chain: ['start', 'greet'], detached: ['end'] }),
    });

    expect(result.passed).toBe(false);
  });

  it('총 이동 거리가 2m 안전 구역을 넘으면 위반으로 막는다', async () => {
    const result = await simulateProgram({
      program: program({ repeatCount: 3, moveDistance: 1 }),
    });

    expect(result.passed).toBe(false);
    expect(result.totalDistanceM).toBe(3);
    expect(result.violations[0]?.code).toBe('exceeds-safe-zone');
    expect(result.violations[0]?.message).toMatch(/안전 구역/);
  });

  it('서버 오류는 ApiError 로 변환된다', async () => {
    server.use(http.post('*/api/simulations', () => new HttpResponse(null, { status: 500 })));

    await expect(simulateProgram({ program: program() })).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    });
  });
});
