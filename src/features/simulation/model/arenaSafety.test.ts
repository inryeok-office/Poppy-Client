import { describe, expect, it } from 'vitest';

import { simulateProgram } from '../api/simulateProgram';
import { DEFAULT_ARENA, type ArenaConfig } from './arena';
import { evaluateProgram, isBlockValueValid, valueRangeText } from './safety';
import type { SerializedBlockNode, SerializedBlockProgram } from './types';

const booth: ArenaConfig = {
  ...DEFAULT_ARENA,
  presetCode: '3x3-부스',
  widthM: 3,
  depthM: 3,
  marginM: 0.5,
  startXM: 2.5,
  startYM: 0.5,
  maxMovePerCommandM: 1.2,
  defaultMoveDistanceM: 0.5,
};

const S: SerializedBlockNode = { id: 's', kind: 'start' };
const E: SerializedBlockNode = { id: 'e', kind: 'end' };
const fwd = (distanceM: number): SerializedBlockNode => ({
  id: `f${distanceM}`,
  kind: 'moveForward',
  distanceM,
});
const left = (degrees: number): SerializedBlockNode => ({
  id: `l${degrees}`,
  kind: 'rotateLeft',
  degrees,
});
const repeat = (count: number, body: SerializedBlockNode[]): SerializedBlockNode => ({
  id: 'r',
  kind: 'repeat',
  count,
  body,
});
const program = (...body: SerializedBlockNode[]): SerializedBlockProgram => ({
  chain: [S, ...body, E],
  detached: [],
});

describe('3×3 부스: 이동 블록 값 범위가 공간을 따른다', () => {
  it('이동 블록 최대값 1.2 m — 1.2 는 통과, 1.3 은 값 오류', () => {
    expect(isBlockValueValid(fwd(1.2), booth)).toBe(true);
    expect(isBlockValueValid(fwd(1.3), booth)).toBe(false);
    expect(isBlockValueValid(fwd(3), booth)).toBe(false);
  });

  it('6×6 기본값에서는 지금과 똑같다(3 m 까지)', () => {
    expect(isBlockValueValid(fwd(3))).toBe(true);
    expect(isBlockValueValid(fwd(3.1))).toBe(false);
    expect(isBlockValueValid(fwd(3), DEFAULT_ARENA)).toBe(true);
  });

  it('입력칸 안내 문구도 공간을 따른다', () => {
    expect(valueRangeText('move', booth).hint).toBe('0.1~1.2 m (0.1 단위)');
    expect(valueRangeText('move', booth).error).toBe('0.1~1.2 m 사이로 입력해 주세요');
    expect(valueRangeText('move').hint).toBe('0.1~3 m (0.1 단위)');
    expect(valueRangeText('wait', booth).hint).toBe('1~10초');
  });
});

describe('3×3 부스: 프로그램 판정', () => {
  it('네모 걷기(1 m ×4, 왼쪽)는 통과', () => {
    expect(evaluateProgram(program(repeat(4, [fwd(1), left(90)])), booth).runnable).toBe(true);
  });

  it('ㄱ자 길(2 m + 2 m)은 1회 이동 한도 1.2 m 초과로 막힌다(6×6 에서는 통과)', () => {
    const lPath = program(fwd(2), left(90), fwd(2));
    expect(evaluateProgram(lPath, booth).valuesValid).toBe(false);
    expect(evaluateProgram(lPath, booth).runnable).toBe(false);
    expect(evaluateProgram(lPath).runnable).toBe(true);
  });

  it('1.2 m 를 두 번 이어 가면 가용 영역(2.0 m)을 넘어 안전 구역 이탈', () => {
    const result = evaluateProgram(program(fwd(1.2), fwd(1.2)), booth);
    expect(result.valuesValid).toBe(true);
    expect(result.violation).toBe('exceeds-safe-zone');
    expect(result.runnable).toBe(false);
  });

  it('simulateProgram 은 요청의 공간으로 판정하고 안내 문구에 3m×3m 를 쓴다', async () => {
    const result = await simulateProgram({ program: program(fwd(1.2), fwd(1.2)), arena: booth });
    expect(result.passed).toBe(false);
    expect(result.violations[0]?.message).toContain('3m×3m');
    const sameOnExpo = await simulateProgram({ program: program(fwd(1.2), fwd(1.2)) });
    expect(sameOnExpo.passed).toBe(true);
  });
});
