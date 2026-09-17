import { describe, expect, it } from 'vitest';

import {
  INITIAL_PROGRAM,
  carriedBlocks,
  deleteCarried,
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

// 시작 → 반복{이동} → 종료 (연결 완료)
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

  it("Server 가 지원하지 않는 'greet' 블록이 스택에 있으면 unsupported-block 오류 (코드리뷰: 기본 프로그램에 있던 greet 가 자동 저장을 실패시킴)", () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0'), node('greet', 'greet-0'), node('end', 'end-0')],
      floating: [],
    };
    expect(validateBlockProgram(program).map((e) => e.code)).toContain('unsupported-block');
  });

  it("자유 블록으로 떠 있는 'greet' 도 unsupported-block 오류를 낸다", () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0'), node('end', 'end-0')],
      floating: [{ id: 'f1', x: 10, y: 10, blocks: [node('greet', 'greet-1')] }],
    };
    expect(validateBlockProgram(program).map((e) => e.code)).toContain('unsupported-block');
  });

  it('greet 가 없으면 unsupported-block 오류가 없다 (기본 프로그램 포함)', () => {
    expect(validateBlockProgram(connected).map((e) => e.code)).not.toContain('unsupported-block');
    expect(validateBlockProgram(INITIAL_PROGRAM).map((e) => e.code)).not.toContain(
      'unsupported-block',
    );
  });
});

describe('carriedBlocks — 아래에 연결된 블록이 함께 딸려온다', () => {
  it('스택 블록을 잡으면 그 아래 블록이 모두 딸려온다', () => {
    const carried = carriedBlocks(connected, { origin: 'stack', nodeId: 'repeat-0' });
    expect(carried.map((b) => b.kind)).toEqual(['repeat', 'end']);
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
    // [start, repeat, end] 에서 end 를 슬롯 1로
    const result = dropOnSlot(connected, { origin: 'stack', nodeId: 'end-0' }, 1);
    expect(result.stack.map((b) => b.kind)).toEqual(['start', 'end', 'repeat']);
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
    const result = dropOnCanvas(connected, { origin: 'stack', nodeId: 'end-0' }, 300, 100);
    expect(result.stack.map((b) => b.kind)).toEqual(['start', 'repeat']);
    const group = result.floating.at(-1);
    expect(group?.blocks.map((b) => b.kind)).toEqual(['end']);
    expect(group).toMatchObject({ x: 300, y: 100 });
  });

  it('자유 그룹을 통째로 옮기면 좌표만 갱신된다', () => {
    const moved = dropOnCanvas(INITIAL_PROGRAM, { origin: 'floating', nodeId: 'end-0' }, 500, 400);
    expect(moved.floating).toHaveLength(1);
    expect(moved.floating[0]).toMatchObject({ id: 'float-end-0', x: 500, y: 400 });
  });
});

describe('deleteCarried — 쓰레기통 드롭 (기명서 "블록 삭제")', () => {
  it('스택 블록을 잡아 지우면 그 아래 연결된 블록도 함께 사라진다', () => {
    // [start, repeat, end] 에서 repeat 을 잡으면 repeat·end 가 함께 지워진다
    const result = deleteCarried(connected, { origin: 'stack', nodeId: 'repeat-0' });
    expect(result.stack.map((b) => b.kind)).toEqual(['start']);
  });

  it('start 는 애초에 못 집으므로 지워지지 않는다', () => {
    expect(deleteCarried(connected, { origin: 'stack', nodeId: 'start-0' })).toBe(connected);
  });

  it('자유 그룹의 블록을 지우면, 남은 블록이 없으면 그룹 자체가 사라진다', () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0')],
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('end', 'end-0')] }],
    };
    const result = deleteCarried(program, { origin: 'floating', nodeId: 'end-0' });
    expect(result.floating).toEqual([]);
  });

  it('자유 그룹 중간 블록을 지우면 그 위의 블록만 그룹에 남는다', () => {
    const program: BlockProgram = {
      stack: [node('start', 'start-0')],
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('greet', 'g1'), node('end', 'e1')] }],
    };
    const result = deleteCarried(program, { origin: 'floating', nodeId: 'e1' });
    expect(result.floating[0]?.blocks.map((b) => b.id)).toEqual(['g1']);
  });
});

describe('setBlockParam', () => {
  it('반복 횟수를 트리 깊이와 상관없이 바꾼다', () => {
    const result = setBlockParam(INITIAL_PROGRAM, 'repeat-0', { count: 5 });
    expect(serializeProgram(result).chain[1]).toMatchObject({ kind: 'repeat', count: 5 });
  });

  it('중첩된 이동 블록 거리도 바꾼다', () => {
    const result = setBlockParam(INITIAL_PROGRAM, 'move-0', { distanceM: 3 });
    expect(serializeProgram(result).chain[1]).toMatchObject({
      kind: 'repeat',
      body: [{ kind: 'move', distanceM: 3 }],
    });
  });

  it('id 가 없는 쪽(자유 블록 그룹)은 새로 만들지 않고 그대로 둔다', () => {
    const program: BlockProgram = {
      stack: INITIAL_PROGRAM.stack,
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('end', 'end-0')] }],
    };
    const result = setBlockParam(program, 'repeat-0', { count: 5 });
    expect(result.floating).toBe(program.floating); // 참조 그대로 — 새로 안 만들었다
  });
});

describe('serializeProgram', () => {
  it('스택을 순서·중첩 그대로 직렬화한다 (블록별 값을 잃지 않는다)', () => {
    expect(serializeProgram(connected)).toEqual({
      chain: [
        { id: 'start-0', kind: 'start' },
        {
          id: 'repeat-0',
          kind: 'repeat',
          count: 2,
          body: [{ id: 'move-0', kind: 'move', distanceM: 1 }],
        },
        { id: 'end-0', kind: 'end' },
      ],
      detached: [],
    });
  });

  it('자유 블록도 직렬화 detached 에 담긴다', () => {
    expect(serializeProgram(INITIAL_PROGRAM).detached).toEqual([{ id: 'end-0', kind: 'end' }]);
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

  it('반복 블록에 count·body 가 없는 손상된 스냅샷은 거부한다 (복원 직후 화면 중단 방지)', () => {
    const broken = {
      stack: [node('start', 'start-0'), node('repeat', 'repeat-0'), node('end', 'end-0')],
      floating: [],
    };
    expect(isBlockProgramSnapshot(broken)).toBe(false);
  });

  it("'start' 가 두 개면 거부한다", () => {
    const broken = {
      stack: [node('start', 'start-0'), node('start', 'start-1'), node('end', 'end-0')],
      floating: [],
    };
    expect(isBlockProgramSnapshot(broken)).toBe(false);
  });

  it("'end' 가 스택 끝과 자유 블록에 중복으로 있으면 거부한다", () => {
    const broken: BlockProgram = {
      stack: [node('start', 'start-0'), node('end', 'end-0')],
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('end', 'end-1')] }],
    };
    expect(isBlockProgramSnapshot(broken)).toBe(false);
  });

  it("반복 블록 body 안에 'end' 가 들어 있으면 거부한다 (개수는 하나뿐이어도)", () => {
    const broken: BlockProgram = {
      stack: [
        node('start', 'start-0'),
        node('repeat', 'repeat-0', { count: 1, body: [node('end', 'end-0')] }),
      ],
      floating: [],
    };
    // countKind 만 봤다면 'end' 가 총 1개라 통과했을 상태 — 위치까지 봐야 걸러진다
    expect(isBlockProgramSnapshot(broken)).toBe(false);
  });
});

describe('totalTravelDistance', () => {
  it('반복 횟수 × 중첩 이동 거리', () => {
    expect(totalTravelDistance(INITIAL_PROGRAM)).toBe(2);
  });

  it("'앞으로 m 이동' 도 '뒤로 m 이동' 과 같이 합산된다", () => {
    const program: BlockProgram = {
      stack: [
        node('start', 'start-0'),
        node('move', 'move-0', { distanceM: 1 }),
        node('moveForward', 'moveForward-0', { distanceM: 2 }),
      ],
      floating: [],
    };
    expect(totalTravelDistance(program)).toBe(3);
  });
});

describe('newBlock — 새 카테고리 블록 기본값', () => {
  it('회전 블록은 회전 허용 범위 최소값으로 시작한다', () => {
    expect(newBlock('rotateLeft')).toMatchObject({ kind: 'rotateLeft', degrees: 1 });
    expect(newBlock('rotateRight')).toMatchObject({ kind: 'rotateRight', degrees: 1 });
  });

  it("'앞으로 m 이동' 은 이동 허용 범위 최소값으로 시작한다", () => {
    expect(newBlock('moveForward')).toMatchObject({ kind: 'moveForward', distanceM: 1 });
  });

  it('파라미터가 없는 동작 블록은 id·kind 만 갖는다', () => {
    expect(newBlock('sit')).toMatchObject({ kind: 'sit' });
    expect(newBlock('attack')).toMatchObject({ kind: 'attack' });
  });
});
