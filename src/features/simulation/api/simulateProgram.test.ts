import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import type { SerializedBlockNode, SerializedBlockProgram } from '../model/types';
import { simulateProgram } from './simulateProgram';

const repeatNode = (count: number, distanceM: number): SerializedBlockNode => ({
  id: 'repeat-0',
  kind: 'repeat',
  count,
  body: [{ id: 'move-0', kind: 'move', distanceM }],
});

const program = (over: Partial<SerializedBlockProgram> = {}): SerializedBlockProgram => ({
  chain: [
    { id: 'start-0', kind: 'start' },
    repeatNode(2, 1),
    { id: 'greet-0', kind: 'greet' },
    { id: 'end-0', kind: 'end' },
  ],
  detached: [],
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
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          { id: 'greet-0', kind: 'greet' },
        ],
        detached: [{ id: 'end-0', kind: 'end' }],
      }),
    });

    expect(result.passed).toBe(false);
  });

  it('총 이동 거리가 2m 안전 구역을 넘으면 위반으로 막는다', async () => {
    const result = await simulateProgram({
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          repeatNode(3, 1),
          { id: 'greet-0', kind: 'greet' },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });

    expect(result.passed).toBe(false);
    expect(result.totalDistanceM).toBe(3);
    expect(result.violations[0]?.code).toBe('exceeds-safe-zone');
    expect(result.violations[0]?.message).toMatch(/안전 구역/);
  });

  it('반복 안 이동과 별도 이동 블록의 거리를 각각 더한다 (첫 값만 뽑지 않는다)', async () => {
    const result = await simulateProgram({
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          repeatNode(2, 1), // 반복 안 이동: 2 × 1m = 2m
          { id: 'move-1', kind: 'move', distanceM: 1 }, // 별도 이동: 1m
          { id: 'greet-0', kind: 'greet' },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });

    // 2m + 1m = 3m — 첫 번째 반복·이동 값만 곱했다면(2×1=2) 안전 구역 안으로 잘못 통과했을 것
    expect(result.totalDistanceM).toBe(3);
    expect(result.passed).toBe(false);
    expect(result.violations[0]?.code).toBe('exceeds-safe-zone');
    // 정규화된 명령 수 = start, repeat, (그 body의 move), move, greet, end = 6
    expect(result.normalizedCommandCount).toBe(6);
  });

  it('음수·범위 밖 값은 서버가 거부한다 (클라이언트 우회 방지)', async () => {
    const result = await simulateProgram({
      program: program({ chain: [{ id: 'start-0', kind: 'start' }, repeatNode(-3, 10)] }),
    });

    expect(result.passed).toBe(false);
    expect(result.totalDistanceM).toBe(0);
    expect(result.violations[0]?.code).toBe('invalid-values');
  });

  it('서버 오류는 ApiError 로 변환된다', async () => {
    server.use(http.post('*/api/simulations', () => new HttpResponse(null, { status: 500 })));

    await expect(simulateProgram({ program: program() })).rejects.toMatchObject({
      name: 'ApiError',
      status: 500,
    });
  });
});
