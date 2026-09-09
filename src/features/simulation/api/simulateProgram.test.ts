import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import { simulateProgram } from './simulateProgram';

describe('simulateProgram (mock API)', () => {
  it('구조가 유효한 프로그램은 통과한다', async () => {
    const result = await simulateProgram({
      program: { chain: ['start', 'repeat', 'move', 'greet', 'end'], detached: [] },
    });

    expect(result.passed).toBe(true);
    expect(result.normalizedCommandCount).toBe(5);
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it("'종료' 로 끝나지 않으면 통과하지 못한다", async () => {
    const result = await simulateProgram({
      program: { chain: ['start', 'greet'], detached: ['end'] },
    });

    expect(result.passed).toBe(false);
  });

  it('서버 오류는 ApiError 로 변환된다', async () => {
    server.use(http.post('/api/simulations', () => new Response(null, { status: 500 })));

    await expect(
      simulateProgram({ program: { chain: ['start', 'end'], detached: [] } }),
    ).rejects.toMatchObject({ name: 'ApiError', status: 500 });
  });
});
