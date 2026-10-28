import { describe, expect, it } from 'vitest';

import {
  INITIAL_PROGRAM,
  canNestInRepeat,
  carriedBlocks,
  deleteCarried,
  describeBlock,
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

const root = (index: number) => ({ parentId: null, index });
const inRepeat = (parentId: string, index: number) => ({ parentId, index });

// 시작 → 반복{이동} → 종료
const connected: BlockProgram = {
  stack: [
    node('start', 'start-0'),
    node('repeat', 'repeat-0', { count: 2, body: [node('move', 'move-0', { distanceM: 1 })] }),
    node('end', 'end-0'),
  ],
  floating: [],
};

const kinds = (nodes: BlockNode[]) => nodes.map((b) => b.kind);
const ids = (nodes: BlockNode[]) => nodes.map((b) => b.id);
const bodyOf = (program: BlockProgram, id: string) => {
  const found = program.stack.find((n) => n.id === id);
  return found?.kind === 'repeat' ? found.body : [];
};

describe('INITIAL_PROGRAM — 시작 → (빈 자리) → 종료 고정 구조', () => {
  it('시작과 종료만 있고 자유 블록이 없다', () => {
    expect(kinds(INITIAL_PROGRAM.stack)).toEqual(['start', 'end']);
    expect(INITIAL_PROGRAM.floating).toEqual([]);
    expect(validateBlockProgram(INITIAL_PROGRAM)).toEqual([]);
  });
});

describe('validateBlockProgram', () => {
  it('시작~종료가 이어지고 자유 블록이 없으면 오류가 없다', () => {
    expect(validateBlockProgram(connected)).toEqual([]);
  });

  it('자유 블록이 떠 있으면 미연결 오류', () => {
    const program: BlockProgram = {
      ...INITIAL_PROGRAM,
      floating: [{ id: 'f1', x: 10, y: 10, blocks: [node('greet', 'greet-1')] }],
    };
    expect(validateBlockProgram(program).map((e) => e.code)).toContain('disconnected-block');
  });

  it('인사하기(PRESET HELLO)는 지원 블록이고, 구르기·공격은 unsupported-block 이다', () => {
    const greet: BlockProgram = {
      stack: [node('start', 's'), node('greet', 'g'), node('end', 'e')],
      floating: [],
    };
    expect(validateBlockProgram(greet)).toEqual([]);
    const roll: BlockProgram = {
      stack: [node('start', 's'), node('roll', 'r'), node('end', 'e')],
      floating: [],
    };
    expect(validateBlockProgram(roll).map((e) => e.code)).toContain('unsupported-block');
  });

  it('입이 빈 반복 블록은 empty-repeat 오류', () => {
    const program: BlockProgram = {
      stack: [node('start', 's'), node('repeat', 'r', { count: 2, body: [] }), node('end', 'e')],
      floating: [],
    };
    expect(validateBlockProgram(program).map((e) => e.code)).toEqual(['empty-repeat']);
  });
});

describe('carriedBlocks — 같은 목록에서 아래 연결된 블록이 함께 딸려온다', () => {
  const program: BlockProgram = {
    stack: [
      node('start', 'start-0'),
      node('wait', 'w1', { seconds: 1 }),
      node('repeat', 'r1', {
        count: 2,
        body: [node('move', 'm1', { distanceM: 1 }), node('rotateLeft', 't1', { degrees: 90 })],
      }),
      node('end', 'end-0'),
    ],
    floating: [],
  };

  it('스택 블록을 잡으면 그 아래 블록이 딸려오지만 고정된 종료는 남는다', () => {
    expect(ids(carriedBlocks(program, { origin: 'stack', nodeId: 'w1' }))).toEqual(['w1', 'r1']);
  });

  it('시작·종료는 잡을 수 없다', () => {
    expect(carriedBlocks(program, { origin: 'stack', nodeId: 'start-0' })).toEqual([]);
    expect(carriedBlocks(program, { origin: 'stack', nodeId: 'end-0' })).toEqual([]);
  });

  it('반복 입 안 블록을 잡으면 입 안에서 그 아래 블록만 딸려온다', () => {
    expect(ids(carriedBlocks(program, { origin: 'stack', nodeId: 'm1' }))).toEqual(['m1', 't1']);
    expect(ids(carriedBlocks(program, { origin: 'stack', nodeId: 't1' }))).toEqual(['t1']);
  });

  it('반복 블록을 잡으면 입 안 블록도 함께 움직인다', () => {
    const [repeat] = carriedBlocks(program, { origin: 'stack', nodeId: 'r1' });
    expect(repeat?.kind === 'repeat' && ids(repeat.body)).toEqual(['m1', 't1']);
  });
});

describe('dropOnSlot — 스택 슬롯', () => {
  it('팔레트 블록은 시작과 종료 사이에만 들어간다', () => {
    const wait = newBlock('wait');
    const first = dropOnSlot(INITIAL_PROGRAM, { origin: 'palette', node: wait }, root(0));
    expect(kinds(first.stack)).toEqual(['start', 'wait', 'end']);
    const last = dropOnSlot(INITIAL_PROGRAM, { origin: 'palette', node: wait }, root(99));
    expect(kinds(last.stack)).toEqual(['start', 'wait', 'end']);
  });

  it('스택 블록 체인을 다른 슬롯으로 옮겨도 종료는 끝에 남는다', () => {
    const program = dropOnSlot(
      connected,
      { origin: 'palette', node: node('wait', 'w1', { seconds: 1 }) },
      root(2),
    );
    expect(ids(program.stack)).toEqual(['start-0', 'repeat-0', 'w1', 'end-0']);
    const moved = dropOnSlot(program, { origin: 'stack', nodeId: 'w1' }, root(1));
    expect(ids(moved.stack)).toEqual(['start-0', 'w1', 'repeat-0', 'end-0']);
  });
});

describe('dropOnSlot — 반복 입 안 넣기·빼기', () => {
  it('팔레트 블록을 반복 입의 원하는 자리에 넣는다', () => {
    const turn = node('rotateRight', 't1', { degrees: 90 });
    const after = dropOnSlot(connected, { origin: 'palette', node: turn }, inRepeat('repeat-0', 1));
    expect(ids(bodyOf(after, 'repeat-0'))).toEqual(['move-0', 't1']);
    const before = dropOnSlot(
      connected,
      { origin: 'palette', node: turn },
      inRepeat('repeat-0', 0),
    );
    expect(ids(bodyOf(before, 'repeat-0'))).toEqual(['t1', 'move-0']);
  });

  it('스택 블록을 반복 입으로 옮기고, 다시 입에서 스택으로 뺀다', () => {
    const program = dropOnSlot(
      connected,
      { origin: 'palette', node: node('wait', 'w1', { seconds: 1 }) },
      root(2),
    );
    const into = dropOnSlot(program, { origin: 'stack', nodeId: 'w1' }, inRepeat('repeat-0', 1));
    expect(ids(into.stack)).toEqual(['start-0', 'repeat-0', 'end-0']);
    expect(ids(bodyOf(into, 'repeat-0'))).toEqual(['move-0', 'w1']);

    const out = dropOnSlot(into, { origin: 'stack', nodeId: 'move-0' }, root(2));
    expect(ids(out.stack)).toEqual(['start-0', 'repeat-0', 'move-0', 'w1', 'end-0']);
    expect(bodyOf(out, 'repeat-0')).toEqual([]);
    expect(validateBlockProgram(out).map((e) => e.code)).toEqual(['empty-repeat']);
  });

  it('반복 안에 반복은 넣을 수 없다 (중첩 금지)', () => {
    const repeat = newBlock('repeat');
    expect(canNestInRepeat([repeat])).toBe(false);
    const result = dropOnSlot(
      connected,
      { origin: 'palette', node: repeat },
      inRepeat('repeat-0', 0),
    );
    expect(result).toBe(connected);
  });

  it('반복 블록을 자기 입 안으로 넣으려 해도 바뀌지 않는다', () => {
    const result = dropOnSlot(
      connected,
      { origin: 'stack', nodeId: 'repeat-0' },
      inRepeat('repeat-0', 0),
    );
    expect(result).toBe(connected);
  });

  it('반복을 옮기면 입 안 블록도 함께 옮겨진다', () => {
    const program = dropOnSlot(
      connected,
      { origin: 'palette', node: node('wait', 'w1', { seconds: 1 }) },
      root(1),
    );
    const moved = dropOnSlot(program, { origin: 'stack', nodeId: 'repeat-0' }, root(1));
    expect(ids(moved.stack)).toEqual(['start-0', 'repeat-0', 'w1', 'end-0']);
    expect(ids(bodyOf(moved, 'repeat-0'))).toEqual(['move-0']);
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

  it('스택 블록을 떼어내 캔버스에 두어도 종료는 스택에 남는다', () => {
    const result = dropOnCanvas(connected, { origin: 'stack', nodeId: 'repeat-0' }, 300, 100);
    expect(kinds(result.stack)).toEqual(['start', 'end']);
    expect(kinds(result.floating.at(-1)?.blocks ?? [])).toEqual(['repeat']);
  });

  it('반복 입 안 블록을 캔버스로 빼낸다', () => {
    const result = dropOnCanvas(connected, { origin: 'stack', nodeId: 'move-0' }, 300, 100);
    expect(bodyOf(result, 'repeat-0')).toEqual([]);
    expect(ids(result.floating.at(-1)?.blocks ?? [])).toEqual(['move-0']);
  });

  it('자유 그룹을 통째로 옮기면 좌표만 갱신된다', () => {
    const program: BlockProgram = {
      ...INITIAL_PROGRAM,
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('wait', 'w1', { seconds: 1 })] }],
    };
    const moved = dropOnCanvas(program, { origin: 'floating', nodeId: 'w1' }, 500, 400);
    expect(moved.floating).toEqual([
      { id: 'f1', x: 500, y: 400, blocks: program.floating[0].blocks },
    ]);
  });
});

describe('deleteCarried — 쓰레기통 드롭 (기명서 "블록 삭제")', () => {
  it('스택 블록을 지우면 아래 블록도 함께 사라지지만 시작·종료는 남는다', () => {
    const result = deleteCarried(connected, { origin: 'stack', nodeId: 'repeat-0' });
    expect(kinds(result.stack)).toEqual(['start', 'end']);
  });

  it('시작·종료는 지울 수 없다', () => {
    expect(deleteCarried(connected, { origin: 'stack', nodeId: 'start-0' })).toBe(connected);
    expect(deleteCarried(connected, { origin: 'stack', nodeId: 'end-0' })).toBe(connected);
  });

  it('자유 그룹의 블록을 모두 지우면 그룹 자체가 사라진다', () => {
    const program: BlockProgram = {
      ...INITIAL_PROGRAM,
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('wait', 'w1', { seconds: 1 })] }],
    };
    expect(deleteCarried(program, { origin: 'floating', nodeId: 'w1' }).floating).toEqual([]);
  });
});

describe('setBlockParam', () => {
  it('반복 횟수와 입 안 이동 거리를 바꾼다', () => {
    const counted = setBlockParam(connected, 'repeat-0', { count: 5 });
    expect(serializeProgram(counted).chain[1]).toMatchObject({ kind: 'repeat', count: 5 });
    const moved = setBlockParam(connected, 'move-0', { distanceM: 3 });
    expect(serializeProgram(moved).chain[1]).toMatchObject({
      body: [{ kind: 'move', distanceM: 3 }],
    });
  });

  it('id 가 없는 쪽(자유 블록 그룹)은 새로 만들지 않고 그대로 둔다', () => {
    const program: BlockProgram = {
      ...connected,
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('wait', 'w1', { seconds: 1 })] }],
    };
    expect(setBlockParam(program, 'repeat-0', { count: 5 }).floating).toBe(program.floating);
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
});

describe('draftToProgram / isBlockProgramSnapshot', () => {
  it('프로그램 스냅샷이면 그대로 복원한다', () => {
    const snapshot = JSON.parse(JSON.stringify(connected));
    expect(isBlockProgramSnapshot(snapshot)).toBe(true);
    expect(draftToProgram(snapshot)).toEqual(connected);
  });

  it('이전 버전 초안(종료가 자유 블록)은 종료를 스택 끝으로 옮겨 복원한다', () => {
    const legacy = {
      stack: [connected.stack[0], connected.stack[1]],
      floating: [{ id: 'float-end-0', x: 325, y: 174, blocks: [node('end', 'end-0')] }],
    };
    expect(draftToProgram(legacy)).toEqual(connected);
  });

  it('종료가 아예 없는 초안은 종료를 붙여 복원한다', () => {
    const restored = draftToProgram({ stack: [node('start', 'start-0')], floating: [] });
    expect(kinds(restored.stack)).toEqual(['start', 'end']);
  });

  it('구버전 초안이나 알 수 없는 값이면 초기 프로그램으로 시작한다', () => {
    expect(isBlockProgramSnapshot({ chain: ['start', 'end'] })).toBe(false);
    expect(draftToProgram({ stack: [], detached: [] })).toBe(INITIAL_PROGRAM);
    expect(draftToProgram(null)).toBe(INITIAL_PROGRAM);
  });

  it('반복 블록에 count·body 가 없는 손상된 스냅샷은 거부한다', () => {
    const broken = {
      stack: [node('start', 'start-0'), node('repeat', 'repeat-0'), node('end', 'end-0')],
      floating: [],
    };
    expect(isBlockProgramSnapshot(broken)).toBe(false);
  });

  it("'start' 가 두 개거나 'end' 가 중복이면 거부한다", () => {
    expect(
      isBlockProgramSnapshot({
        stack: [node('start', 's0'), node('start', 's1'), node('end', 'e0')],
        floating: [],
      }),
    ).toBe(false);
    expect(
      isBlockProgramSnapshot({
        stack: [node('start', 's0'), node('end', 'e0')],
        floating: [{ id: 'f1', x: 0, y: 0, blocks: [node('end', 'e1')] }],
      }),
    ).toBe(false);
  });

  it('반복 입 안에 종료나 반복이 들어 있으면 거부한다', () => {
    const withEnd = {
      stack: [node('start', 's0'), node('repeat', 'r0', { count: 1, body: [node('end', 'e0')] })],
      floating: [],
    };
    const nested = {
      stack: [
        node('start', 's0'),
        node('repeat', 'r0', {
          count: 1,
          body: [node('repeat', 'r1', { count: 1, body: [] })],
        }),
        node('end', 'e0'),
      ],
      floating: [],
    };
    expect(isBlockProgramSnapshot(withEnd)).toBe(false);
    expect(isBlockProgramSnapshot(nested)).toBe(false);
  });
});

describe('totalTravelDistance', () => {
  it('반복 횟수 × 입 안 이동 거리', () => {
    expect(totalTravelDistance(connected)).toBe(2);
  });

  it("'앞으로 m 이동' 도 '뒤로 m 이동' 과 같이 합산된다", () => {
    const program: BlockProgram = {
      stack: [
        node('start', 'start-0'),
        node('move', 'move-0', { distanceM: 1 }),
        node('moveForward', 'moveForward-0', { distanceM: 2 }),
        node('end', 'end-0'),
      ],
      floating: [],
    };
    expect(totalTravelDistance(program)).toBe(3);
  });
});

describe('newBlock — 새 카테고리 블록 기본값', () => {
  it('회전 블록은 기본 90° 로 시작한다', () => {
    expect(newBlock('rotateLeft')).toMatchObject({ kind: 'rotateLeft', degrees: 90 });
    expect(newBlock('rotateRight')).toMatchObject({ kind: 'rotateRight', degrees: 90 });
  });

  it('반복 블록은 기본 4회로 시작한다', () => {
    expect(newBlock('repeat')).toMatchObject({ kind: 'repeat', count: 4, body: [] });
  });

  it("'앞으로 m 이동' 은 기본 0.5 m 로 시작한다", () => {
    expect(newBlock('moveForward')).toMatchObject({ kind: 'moveForward', distanceM: 0.5 });
  });

  it('파라미터가 없는 동작 블록은 id·kind 만 갖는다', () => {
    expect(newBlock('sit')).toMatchObject({ kind: 'sit' });
    expect(newBlock('attack')).toMatchObject({ kind: 'attack' });
  });
});

describe('describeBlock — 실행순서 등 읽기 전용 목록에 쓰는 한 줄 설명', () => {
  it('값 있는 블록은 값을 문구에 넣는다', () => {
    expect(describeBlock({ id: 'a', kind: 'move', distanceM: 3 })).toBe('뒤로 3m 이동');
    expect(describeBlock({ id: 'a', kind: 'rotateRight', degrees: 90 })).toBe(
      '오른쪽으로 90° 회전',
    );
    expect(describeBlock({ id: 'a', kind: 'wait', seconds: 5 })).toBe('5초 기다리기');
  });

  it('값 없는 블록은 이름만 반환한다', () => {
    expect(describeBlock({ id: 'a', kind: 'start' })).toBe('시작');
    expect(describeBlock({ id: 'a', kind: 'attack' })).toBe('공격');
  });
});
