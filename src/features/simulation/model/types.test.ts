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

  it('정지·앉기·일어서기를 STOP·SIT·STAND 로 변환한다', () => {
    expect(
      program({ id: 'x', kind: 'stop' }, { id: 's', kind: 'sit' }, { id: 'u', kind: 'standUp' })
        .blocks,
    ).toEqual([
      { id: 'x', type: 'STOP', parameters: {} },
      { id: 's', type: 'SIT', parameters: {} },
      { id: 'u', type: 'STAND', parameters: {} },
    ]);
  });

  it('인사하기·하트·춤추기를 PRESET 의 HELLO·HEART·DANCE1 로 변환한다', () => {
    expect(
      program({ id: 'g', kind: 'greet' }, { id: 'h', kind: 'heart' }, { id: 'd', kind: 'dance' })
        .blocks,
    ).toEqual([
      { id: 'g', type: 'PRESET', parameters: { presetCode: 'HELLO' } },
      { id: 'h', type: 'PRESET', parameters: { presetCode: 'HEART' } },
      { id: 'd', type: 'PRESET', parameters: { presetCode: 'DANCE1' } },
    ]);
  });

  it('검증된 프리셋이 없는 구르기·공격은 계속 거부한다', () => {
    expect(() => program({ id: 'r', kind: 'roll' })).toThrow('ROLL');
    expect(() => program({ id: 'a', kind: 'attack' })).toThrow('ATTACK');
  });
});
