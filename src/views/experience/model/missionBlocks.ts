import type { BlockKind } from './blockProgram';

// 미션 상세 allowedBlocks(Server BlockType) → 팔레트 블록 종류.
// 시작·종료는 항상 캔버스에 고정이라 목록에 넣지 않는다.
const SERVER_TYPE_TO_KINDS: Record<string, BlockKind[]> = {
  WAIT: ['wait'],
  REPEAT: ['repeat'],
  MOVE_FORWARD: ['moveForward'],
  MOVE_BACKWARD: ['move'],
  TURN_LEFT: ['rotateLeft'],
  TURN_RIGHT: ['rotateRight'],
  STOP: ['stop'],
  SIT: ['sit'],
  STAND: ['standUp'],
  PRESET: ['greet', 'heart', 'dance'],
};

/** 미션이 허용한 블록 종류 집합 (모르는 타입은 무시). */
export function kindsForServerTypes(types: readonly string[]): Set<BlockKind> {
  return new Set(types.flatMap((type) => SERVER_TYPE_TO_KINDS[type] ?? []));
}
