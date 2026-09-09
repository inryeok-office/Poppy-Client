import { describe, expect, it } from 'vitest';

import {
  INITIAL_PROGRAM,
  connectDetachedBlocks,
  validateBlockProgram,
  type BlockProgram,
} from './blockProgram';

describe('validateBlockProgram', () => {
  it('초기 프로그램은 종료 미연결 오류가 있다', () => {
    const errors = validateBlockProgram(INITIAL_PROGRAM);
    expect(errors.map((e) => e.code)).toContain('missing-end');
  });

  it('시작~종료가 이어지고 떨어진 블록이 없으면 오류가 없다', () => {
    const program: BlockProgram = {
      chain: ['start', 'repeat', 'move', 'greet', 'end'],
      detached: [],
    };
    expect(validateBlockProgram(program)).toEqual([]);
  });

  it('종료가 아닌 블록이 떨어져 있으면 미연결 오류', () => {
    const program: BlockProgram = { chain: ['start', 'end'], detached: ['greet'] };
    expect(validateBlockProgram(program).map((e) => e.code)).toContain('disconnected-block');
  });

  it('오류 메시지는 수정 방법을 담는다', () => {
    for (const error of validateBlockProgram(INITIAL_PROGRAM)) {
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});

describe('connectDetachedBlocks', () => {
  it('떨어진 블록을 스택 끝으로 옮기고 검증을 통과시킨다', () => {
    const connected = connectDetachedBlocks(INITIAL_PROGRAM);
    expect(connected.detached).toEqual([]);
    expect(connected.chain.at(-1)).toBe('end');
    expect(validateBlockProgram(connected)).toEqual([]);
  });

  it('떨어진 블록이 없으면 그대로 반환한다', () => {
    const program: BlockProgram = { chain: ['start', 'end'], detached: [] };
    expect(connectDetachedBlocks(program)).toBe(program);
  });
});
