import { describe, expect, it } from 'vitest';

import {
  INITIAL_PROGRAM,
  carriedBlocks,
  draftToProgram,
  dropOnCanvas,
  dropOnSlot,
  isBlockProgramSnapshot,
  newBlock,
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

// 시작 → 반복{이동} → 인사 → 종료 (연결 완료)
const connected: BlockProgram = {
  stack: [...INITIAL_PROGRAM.stack, node('end', 'end-0')],
  floating: [],
};

describe('validateBlockProgram', () => {
  it('초기 프로그램은 종료 미연결 오류가 있다', () => {
    expect(validateBlockProgram(INITIAL_PROGRAM).map((e) => e.code)).toContain('missing-end');
  });

  it('시작~종료가 이어지고 자유 블록이 없으면 오류가 없다', () => {
    expect(validateBlockProgram(connected)).toEqual([]);
  });

  it('종료가 아닌 블록이 자유롭게 떠 있으면 미연결 오류', () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0'), node('end', 'end-0')],
      floating: [{ id: 'f1', x: 10, y: 10, blocks: [node('greet', 'greet-1')] }],
    };
    expect(validateBlockProgram(program).map((e) => e.code)).toContain('disconnected-block');
  });
});

describe('carriedBlocks — 아래에 연결된 블록이 함께 딸려온다', () => {
  it('스택 블록을 잡으면 그 아래 블록이 모두 딸려온다', () => {
    const carried = carriedBlocks(connected, { origin: 'stack', nodeId: 'repeat-0' });
    expect(carried.map((b) => b.kind)).toEqual(['repeat', 'greet', 'end']);
  });

  it('start 는 잡을 수 없다', () => {
    expect(carriedBlocks(connected, { origin: 'stack', nodeId: 'start-0' })).toEqual([]);
  });

  it('자유 그룹 중간 블록을 잡으면 그 아래만 딸려온다', () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0')],
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('greet', 'g1'), node('end', 'e1')] }],
    };
    expect(carriedBlocks(program, { origin: 'floating', nodeId: 'e1' }).map((b) => b.id)).toEqual([
      'e1',
    ]);
  });
});

describe('dropOnSlot — 스냅 연결', () => {
  it('팔레트 블록을 슬롯에 연결한다', () => {
    const greet = newBlock('greet');
    const result = dropOnSlot(INITIAL_PROGRAM, { origin: 'palette', node: greet }, 1);
    expect(result.stack[1]?.id).toBe(greet.id);
    expect(result.stack[0]?.kind).toBe('start');
  });

  it('떨어진 종료를 스택 끝에 연결하면 자유 그룹이 사라진다', () => {
    const result = dropOnSlot(INITIAL_PROGRAM, { origin: 'floating', nodeId: 'end-0' }, 3);
    expect(result.floating).toEqual([]);
    expect(result.stack.at(-1)?.kind).toBe('end');
    expect(validateBlockProgram(result)).toEqual([]);
  });

  it('스택 블록을 잡아 딸려온 체인을 다른 슬롯으로 옮긴다', () => {
    // [start, repeat, greet, end] 에서 greet 이하(greet,end)를 슬롯 1로
    const result = dropOnSlot(connected, { origin: 'stack', nodeId: 'greet-0' }, 1);
    expect(result.stack.map((b) => b.kind)).toEqual(['start', 'greet', 'end', 'repeat']);
  });
});

describe('dropOnCanvas — 스냅 밖: 놓은 자리에 둔다', () => {
  it('팔레트 블록을 캔버스 (x,y) 에 자유 그룹으로 놓는다', () => {
    const wait = newBlock('wait');
    const result = dropOnCanvas(INITIAL_PROGRAM, { origin: 'palette', node: wait }, 120, 240);
    const group = result.floating.find((g) => g.blocks[0]?.id === wait.id);
    expect(group).toMatchObject({ x: 120, y: 240 });
    expect(result.stack).toEqual(INITIAL_PROGRAM.stack);
  });

  it('스택 블록 체인을 떼어내 캔버스에 둔다', () => {
    const result = dropOnCanvas(connected, { origin: 'stack', nodeId: 'greet-0' }, 300, 100);
    expect(result.stack.map((b) => b.kind)).toEqual(['start', 'repeat']);
    const group = result.floating.at(-1);
    expect(group?.blocks.map((b) => b.kind)).toEqual(['greet', 'end']);
    expect(group).toMatchObject({ x: 300, y: 100 });
  });

  it('자유 그룹을 통째로 옮기면 좌표만 갱신된다', () => {
    const moved = dropOnCanvas(INITIAL_PROGRAM, { origin: 'floating', nodeId: 'end-0' }, 500, 400);
    expect(moved.floating).toHaveLength(1);
    expect(moved.floating[0]).toMatchObject({ id: 'float-end-0', x: 500, y: 400 });
  });
});

describe('setBlockParam', () => {
  it('반복 횟수를 트리 깊이와 상관없이 바꾼다', () => {
    const result = setBlockParam(INITIAL_PROGRAM, 'repeat-0', { count: 5 });
    expect(serializeProgram(result).repeatCount).toBe(5);
  });

  it('중첩된 이동 블록 거리도 바꾼다', () => {
    const result = setBlockParam(INITIAL_PROGRAM, 'move-0', { distanceM: 3 });
    expect(serializeProgram(result).moveDistance).toBe(3);
  });
});

describe('serializeProgram', () => {
  it('스택을 flat 형태로 평탄화한다', () => {
    expect(serializeProgram(connected)).toEqual({
      chain: ['start', 'repeat', 'move', 'greet', 'end'],
      detached: [],
      repeatCount: 2,
      moveDistance: 1,
    });
  });

  it('자유 블록도 직렬화 detached 에 담긴다', () => {
    expect(serializeProgram(INITIAL_PROGRAM).detached).toEqual(['end']);
  });
});

describe('draftToProgram / isBlockProgramSnapshot', () => {
  it('프로그램 스냅샷이면 그대로 복원한다', () => {
    const snapshot = JSON.parse(JSON.stringify(connected));
    expect(isBlockProgramSnapshot(snapshot)).toBe(true);
    expect(draftToProgram(snapshot).stack.at(-1)?.kind).toBe('end');
  });

  it('구버전 초안이나 알 수 없는 값이면 초기 프로그램으로 시작한다', () => {
    expect(isBlockProgramSnapshot({ chain: ['start', 'end'] })).toBe(false);
    expect(draftToProgram({ stack: [], detached: [] })).toBe(INITIAL_PROGRAM);
    expect(draftToProgram(null)).toBe(INITIAL_PROGRAM);
  });
});

describe('totalTravelDistance', () => {
  it('반복 횟수 × 중첩 이동 거리', () => {
    expect(totalTravelDistance(INITIAL_PROGRAM)).toBe(2);
  });
});
