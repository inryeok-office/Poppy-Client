import { describe, expect, it } from 'vitest';

import { toServerBlockProgram, type SerializedBlockNode } from './types';

const program = (...chain: SerializedBlockNode[]) => toServerBlockProgram({ chain, detached: [] });

describe('toServerBlockProgram — Server v1 블록 계약 변환', () => {
  it('왼쪽·오른쪽 회전 블록을 TURN_LEFT·TURN_RIGHT 와 angleDegrees 로 변환한다', () => {
    expect(
      program(
        { id: 'l', kind: 'rotateLeft', degrees: 6 },
        { id: 'r', kind: 'rotateRight', degrees: 90 },
      ).blocks,
    ).toEqual([
      { id: 'l', type: 'TURN_LEFT', parameters: { angleDegrees: 6 } },
      { id: 'r', type: 'TURN_RIGHT', parameters: { angleDegrees: 90 } },
    ]);
  });

  it("'뒤로 이동'(move)은 MOVE_BACKWARD, '앞으로 이동'(moveForward)은 MOVE_FORWARD 다", () => {
    expect(
      program(
        { id: 'b', kind: 'move', distanceM: 1 },
        { id: 'f', kind: 'moveForward', distanceM: 2 },
      ).blocks,
    ).toEqual([
      { id: 'b', type: 'MOVE_BACKWARD', parameters: { distanceMeters: 1 } },
      { id: 'f', type: 'MOVE_FORWARD', parameters: { distanceMeters: 2 } },
    ]);
  });

  it('시작 → 왼쪽 6° 회전 → 종료 프로그램을 schemaVersion 1 로 만든다', () => {
    expect(
      program(
        { id: 's', kind: 'start' },
        { id: 't', kind: 'rotateLeft', degrees: 6 },
        { id: 'e', kind: 'end' },
      ),
    ).toEqual({
      schemaVersion: 1,
      blocks: [
        { id: 's', type: 'START', parameters: {} },
        { id: 't', type: 'TURN_LEFT', parameters: { angleDegrees: 6 } },
        { id: 'e', type: 'END', parameters: {} },
      ],
    });
  });

  it('Server 계약에 없는 블록은 계속 거부한다', () => {
    expect(() => program({ id: 'g', kind: 'greet' })).toThrow('GREET');
    expect(() => program({ id: 's', kind: 'sit' })).toThrow('SIT');
  });
});
