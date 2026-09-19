import { describe, expect, it } from 'vitest';

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

describe('simulateProgram local evaluation', () => {
  it('passes a valid program inside the safe zone', async () => {
    const result = await simulateProgram({ program: program() });
    expect(result.passed).toBe(true);
    expect(result.totalDistanceM).toBe(2);
    expect(result.violations).toEqual([]);
  });

  it('rejects a program without an end block', async () => {
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

  it('reports a safe-zone violation', async () => {
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
    expect(result.violations[0]?.message).toContain('안전 구역');
  });

  it('keeps repeated and standalone movement in the total', async () => {
    const result = await simulateProgram({
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          repeatNode(2, 1),
          { id: 'move-1', kind: 'move', distanceM: 1 },
          { id: 'greet-0', kind: 'greet' },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });
    expect(result.totalDistanceM).toBe(3);
    expect(result.passed).toBe(false);
    expect(result.normalizedCommandCount).toBe(6);
  });

  it('rejects invalid values without a server call', async () => {
    const result = await simulateProgram({
      program: program({ chain: [{ id: 'start-0', kind: 'start' }, repeatNode(-3, 10)] }),
    });
    expect(result.passed).toBe(false);
    expect(result.totalDistanceM).toBe(0);
    expect(result.violations[0]?.code).toBe('invalid-values');
  });

  it('counts moveForward the same as move toward the total distance', async () => {
    const result = await simulateProgram({
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          { id: 'move-0', kind: 'move', distanceM: 1 },
          { id: 'moveForward-0', kind: 'moveForward', distanceM: 1 },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });

    expect(result.totalDistanceM).toBe(2);
  });

  it('rejects a rotation outside the allowed degree range', async () => {
    const result = await simulateProgram({
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          { id: 'rotate-0', kind: 'rotateRight', degrees: 400 },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });

    expect(result.passed).toBe(false);
    expect(result.violations[0]?.code).toBe('invalid-values');
  });

  describe('steps (Figma Slide 6·7 실행순서)', () => {
    it('marks every step done when the program stays inside the safe zone', async () => {
      const result = await simulateProgram({
        program: program({
          chain: [
            { id: 'start-0', kind: 'start' },
            { id: 'move-0', kind: 'move', distanceM: 1 },
            { id: 'end-0', kind: 'end' },
          ],
        }),
      });

      expect(result.steps.map((s) => s.status)).toEqual(['done', 'done', 'done']);
    });

    it('unrolls repeat by its actual count and marks the step that crosses the safe zone as failed, the rest pending', async () => {
      const result = await simulateProgram({
        program: program({
          chain: [
            { id: 'start-0', kind: 'start' },
            repeatNode(3, 1), // 1m × 3회 — 2번째 반복(누적 2m)까지 안전, 3번째(누적 3m)에서 넘는다
            { id: 'greet-0', kind: 'greet' },
            { id: 'end-0', kind: 'end' },
          ],
        }),
      });

      // start, move, move, move(초과), greet, end
      expect(result.steps.map((s) => s.status)).toEqual([
        'done',
        'done',
        'done',
        'failed',
        'pending',
        'pending',
      ]);
    });

    it('leaves steps empty when values are invalid (nothing safe to walk)', async () => {
      const result = await simulateProgram({
        program: program({ chain: [{ id: 'start-0', kind: 'start' }, repeatNode(-3, 10)] }),
      });

      expect(result.steps).toEqual([]);
    });
  });
});
