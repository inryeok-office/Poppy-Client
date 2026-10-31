import { describe, expect, it } from 'vitest';

import type { SerializedBlockNode, SerializedBlockProgram } from '../model/types';
import { simulateProgram } from './simulateProgram';

const repeatNode = (count: number, distanceM: number): SerializedBlockNode => ({
  id: 'repeat-0',
  kind: 'repeat',
  count,
  body: [{ id: 'move-0', kind: 'moveForward', distanceM }],
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
          repeatNode(7, 1),
          { id: 'greet-0', kind: 'greet' },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });
    expect(result.passed).toBe(false);
    expect(result.totalDistanceM).toBe(7);
    expect(result.violations[0]?.code).toBe('exceeds-safe-zone');
    expect(result.violations[0]?.message).toBe(
      '7번째 블록에서 안전 구역(6m×6m) 밖으로 나가요. 거리를 줄이거나 방향을 바꿔 주세요.',
    );
  });

  it('keeps repeated and standalone movement in the total', async () => {
    const result = await simulateProgram({
      program: program({
        chain: [
          { id: 'start-0', kind: 'start' },
          repeatNode(5, 1),
          { id: 'move-1', kind: 'moveForward', distanceM: 1 },
          { id: 'greet-0', kind: 'greet' },
          { id: 'end-0', kind: 'end' },
        ],
      }),
    });
    expect(result.totalDistanceM).toBe(6);
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
          { id: 'move-0', kind: 'moveForward', distanceM: 1 },
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
            { id: 'move-0', kind: 'moveForward', distanceM: 1 },
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
            repeatNode(7, 1), // 1m × 7회 — 5번째 반복(y=5.4)까지 안전, 6번째(y=6.4)에서 벗어난다
            { id: 'greet-0', kind: 'greet' },
            { id: 'end-0', kind: 'end' },
          ],
        }),
      });

      // start, move ×5, move(이탈), move, greet, end
      expect(result.steps.map((s) => s.status)).toEqual([
        'done',
        'done',
        'done',
        'done',
        'done',
        'done',
        'failed',
        'pending',
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
