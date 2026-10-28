import { describe, expect, it } from 'vitest';

import {
  SNAP_THRESHOLD_PX,
  isNearRect,
  movedEnough,
  nearestSlot,
  slotsFromBlockRects,
  slotsFromLayout,
} from './blockDrag';

const rect = (top: number, height = 44, left = 60, width = 212): DOMRect =>
  ({
    top,
    left,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON() {},
  }) as DOMRect;

describe('slotsFromBlockRects', () => {
  it('블록 사이·마지막 뒤로 슬롯을 만든다 (인덱스 1..n)', () => {
    const slots = slotsFromBlockRects([rect(100), rect(150), rect(200)]);
    expect(slots.map((s) => s.index)).toEqual([1, 2, 3]);
    // 슬롯 1 = 블록0 하단(144)과 블록1 상단(150)의 중점 (가까운 슬롯 판정 기준)
    expect(slots[0].centerY).toBe(147);
    // 마지막 슬롯 = 마지막 블록 하단
    expect(slots[2].centerY).toBe(244);
    // 미리보기 표시 위치(top)는 -6px 노치만큼 겹쳐 물리는 실제 자리 — 중점이 아니다
    expect(slots[0].top).toBe(138);
    expect(slots[2].top).toBe(238);
    // 가로 범위는 블록에서 가져온다
    expect(slots[0]).toMatchObject({ left: 60, right: 272 });
  });

  it('블록이 없으면 슬롯도 없다', () => {
    expect(slotsFromBlockRects([])).toEqual([]);
  });
});

describe('nearestSlot', () => {
  const slots = slotsFromBlockRects([rect(100), rect(150), rect(200)]); // left 60, right 272

  it('세로·가로 모두 임계 안이면 가장 가까운 슬롯을 고른다', () => {
    expect(nearestSlot(150, 146, slots)?.index).toBe(1);
    expect(nearestSlot(150, 210, slots)?.index).toBe(2);
  });

  it('세로는 맞아도 가로로 스택에서 멀면 스냅하지 않는다 (그 자리에 둔다)', () => {
    expect(nearestSlot(600, 147, slots)).toBeNull();
  });

  it('세로가 임계 밖이면 null', () => {
    expect(nearestSlot(150, 244 + SNAP_THRESHOLD_PX + 10, slots)).toBeNull();
    expect(nearestSlot(150, -500, slots)).toBeNull();
  });
});

describe('isNearRect — 쓰레기통 삭제 감지 영역 (기명서 "시각 영역 바깥 30px")', () => {
  const trash = rect(500, 80, 1000, 64); // top 500 bottom 580, left 1000 right 1064

  it('시각 영역 안이면 감지된다', () => {
    expect(isNearRect(1030, 540, trash, 30)).toBe(true);
  });

  it('시각 영역 바깥이어도 margin 안이면 감지된다', () => {
    expect(isNearRect(1064 + 20, 540, trash, 30)).toBe(true); // 오른쪽으로 20px 밖
    expect(isNearRect(1030, 580 + 20, trash, 30)).toBe(true); // 아래로 20px 밖
  });

  it('margin 밖이면 감지되지 않는다', () => {
    expect(isNearRect(1064 + 40, 540, trash, 30)).toBe(false);
    expect(isNearRect(1030, 580 + 40, trash, 30)).toBe(false);
  });
});

describe('movedEnough', () => {
  it('작은 흔들림은 드래그가 아니다', () => {
    expect(movedEnough({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe(false);
  });

  it('임계를 넘으면 드래그', () => {
    expect(movedEnough({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(true);
  });
});

describe('slotsFromLayout — 스택과 반복 입 슬롯', () => {
  const block = (id: string, kind: string, parent: string, top: number, left = 60) => ({
    id,
    kind,
    parent,
    rect: rect(top, 44, left),
  });
  // 시작(100) → 반복(146, 입 184) { 이동(184) } → 종료(300)
  const blocks = [
    block('s', 'start', 'root', 100),
    block('r', 'repeat', 'root', 146, 60),
    block('m', 'move', 'r', 184, 86),
    block('e', 'end', 'root', 300),
  ];
  const mouths = [{ repeatId: 'r', rect: rect(184, 0, 86) }];

  it('스택 슬롯은 시작 다음부터 종료 앞까지만 만든다', () => {
    const slots = slotsFromLayout(blocks, mouths, false);
    expect(slots.map((s) => [s.parentId, s.index])).toEqual([
      [null, 1],
      [null, 2],
    ]);
  });

  it('반복 입 슬롯은 입 맨 위(0)와 각 블록 다음에 만든다', () => {
    const slots = slotsFromLayout(blocks, mouths, true).filter((s) => s.parentId === 'r');
    expect(slots.map((s) => s.index)).toEqual([0, 1]);
    expect(slots[0]).toMatchObject({ top: 184, left: 86 });
    expect(slots[1]).toMatchObject({ centerY: 228, top: 222 });
  });

  it('반복을 옮기는 중(중첩 금지)이면 입 슬롯을 만들지 않는다', () => {
    expect(slotsFromLayout(blocks, mouths, false).some((s) => s.parentId !== null)).toBe(false);
  });

  it('빈 입에도 맨 위 슬롯 하나가 생긴다', () => {
    const empty = [
      block('s', 'start', 'root', 100),
      block('r', 'repeat', 'root', 146),
      block('e', 'end', 'root', 260),
    ];
    const slots = slotsFromLayout(empty, [{ repeatId: 'r', rect: rect(184, 48, 86) }], true);
    expect(slots.filter((s) => s.parentId === 'r').map((s) => s.index)).toEqual([0]);
  });
});
