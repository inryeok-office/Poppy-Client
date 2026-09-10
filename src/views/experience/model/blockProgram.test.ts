import { describe, expect, it } from 'vitest';

import {
  INITIAL_PROGRAM,
  blockCommandCount,
  connectDetachedBlocks,
  draftToProgram,
  insertBlock,
  isBlockProgramSnapshot,
  moveBlock,
  newBlock,
  removeBlock,
  serializeProgram,
  setBlockParam,
  totalTravelDistance,
  validateBlockProgram,
  type BlockNode,
  type BlockProgram,
} from './blockProgram';

const node = (
  kind: BlockNode['kind'],
  id: string,
  extra: Record<string, unknown> = {},
): BlockNode => ({ id, kind, ...extra }) as BlockNode;

const connected: BlockProgram = {
  stack: [...INITIAL_PROGRAM.stack, node('end', 'end-0')],
  detached: [],
};

describe('validateBlockProgram', () => {
  it('초기 프로그램은 종료 미연결 오류가 있다', () => {
    expect(validateBlockProgram(INITIAL_PROGRAM).map((e) => e.code)).toContain('missing-end');
  });

  it('시작~종료가 이어지고 떨어진 블록이 없으면 오류가 없다', () => {
    expect(validateBlockProgram(connected)).toEqual([]);
  });

  it('종료가 아닌 블록이 떨어져 있으면 미연결 오류', () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0'), node('end', 'end-0')],
      detached: [node('greet', 'greet-1')],
    };
    expect(validateBlockProgram(program).map((e) => e.code)).toContain('disconnected-block');
  });

  it('오류 메시지는 수정 방법을 담는다', () => {
    for (const error of validateBlockProgram(INITIAL_PROGRAM)) {
      expect(error.message.length).toBeGreaterThan(0);
    }
  });
});

describe('connectDetachedBlocks', () => {
  it('떨어진 블록을 스택 끝으로 옮기고 값은 유지한다', () => {
    const result = connectDetachedBlocks(INITIAL_PROGRAM);
    expect(result.detached).toEqual([]);
    expect(result.stack.at(-1)?.kind).toBe('end');
    expect(serializeProgram(result).repeatCount).toBe(
      serializeProgram(INITIAL_PROGRAM).repeatCount,
    );
    expect(validateBlockProgram(result)).toEqual([]);
  });

  it('떨어진 블록이 없으면 그대로 반환한다', () => {
    expect(connectDetachedBlocks(connected)).toBe(connected);
  });
});

describe('insertBlock / moveBlock / removeBlock', () => {
  it('insertBlock 은 지정 위치에 끼우고, start 앞에는 못 넣는다', () => {
    const greet = newBlock('greet');
    const result = insertBlock(INITIAL_PROGRAM, greet, 0);
    expect(result.stack[0]?.kind).toBe('start');
    expect(result.stack[1]?.id).toBe(greet.id);
    expect(result.stack.length).toBe(INITIAL_PROGRAM.stack.length + 1);
  });

  it('insertBlock 은 같은 id 의 떨어진 블록을 정리한다', () => {
    const end = INITIAL_PROGRAM.detached[0];
    const result = insertBlock(INITIAL_PROGRAM, end, INITIAL_PROGRAM.stack.length);
    expect(result.detached).toEqual([]);
    expect(result.stack.at(-1)?.id).toBe(end.id);
  });

  it('moveBlock 은 스택 안에서 순서를 바꾸고 start 는 못 옮긴다', () => {
    const moved = moveBlock(connected, 'greet-0', 1);
    expect(moved.stack.map((n) => n.kind)).toEqual(['start', 'greet', 'repeat', 'end']);
    expect(moveBlock(connected, 'start-0', 3)).toBe(connected);
  });

  it('removeBlock 은 블록을 지우고 start 는 못 지운다', () => {
    expect(removeBlock(connected, 'greet-0').stack.some((n) => n.kind === 'greet')).toBe(false);
    expect(removeBlock(connected, 'start-0')).toBe(connected);
  });
});

describe('setBlockParam', () => {
  it('반복 횟수를 트리 깊이와 상관없이 찾아 바꾼다', () => {
    const result = setBlockParam(INITIAL_PROGRAM, 'repeat-0', { count: 5 });
    expect(serializeProgram(result).repeatCount).toBe(5);
  });

  it('중첩된 이동 블록 거리도 바꾼다', () => {
    const result = setBlockParam(INITIAL_PROGRAM, 'move-0', { distanceM: 3 });
    expect(serializeProgram(result).moveDistance).toBe(3);
  });
});

describe('serializeProgram', () => {
  it('트리를 서버가 받는 flat 형태로 평탄화한다', () => {
    expect(serializeProgram(connected)).toEqual({
      chain: ['start', 'repeat', 'move', 'greet', 'end'],
      detached: [],
      repeatCount: 2,
      moveDistance: 1,
    });
  });

  it('떨어진 종료도 직렬화에 담긴다', () => {
    expect(serializeProgram(INITIAL_PROGRAM).detached).toEqual(['end']);
  });
});

describe('draftToProgram / isBlockProgramSnapshot', () => {
  it('트리 스냅샷이면 그대로 복원한다', () => {
    const snapshot = JSON.parse(JSON.stringify(connected));
    expect(isBlockProgramSnapshot(snapshot)).toBe(true);
    expect(draftToProgram(snapshot).stack.at(-1)?.kind).toBe('end');
  });

  it('구버전 flat 초안이나 알 수 없는 값이면 초기 프로그램으로 시작한다', () => {
    expect(isBlockProgramSnapshot({ chain: ['start', 'end'] })).toBe(false);
    expect(draftToProgram({ chain: ['start', 'end'] })).toBe(INITIAL_PROGRAM);
    expect(draftToProgram(null)).toBe(INITIAL_PROGRAM);
  });
});

describe('totalTravelDistance', () => {
  it('반복 횟수 × 중첩 이동 거리', () => {
    const program: BlockProgram = {
      stack: [
        node('start', 'start-0'),
        node('repeat', 'repeat-0', {
          count: 3,
          body: [node('move', 'move-0', { distanceM: 2 })],
        }),
        node('end', 'end-0'),
      ],
      detached: [],
    };
    expect(totalTravelDistance(program)).toBe(6);
    expect(totalTravelDistance(INITIAL_PROGRAM)).toBe(2);
  });
});

describe('blockCommandCount', () => {
  it('스택을 평탄화한 명령 수', () => {
    expect(blockCommandCount(connected)).toBe(5);
  });
});
