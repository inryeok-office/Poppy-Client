import { describe, expect, it } from 'vitest';

import { SNAP_THRESHOLD_PX, movedEnough, nearestSlot, slotsFromBlockRects } from './blockDrag';

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
    // 슬롯 1 = 블록0 하단(144)과 블록1 상단(150)의 중점
    expect(slots[0].centerY).toBe(147);
    // 마지막 슬롯 = 마지막 블록 하단
    expect(slots[2].centerY).toBe(244);
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

describe('movedEnough', () => {
  it('작은 흔들림은 드래그가 아니다', () => {
    expect(movedEnough({ x: 0, y: 0 }, { x: 2, y: 1 })).toBe(false);
  });

  it('임계를 넘으면 드래그', () => {
    expect(movedEnough({ x: 0, y: 0 }, { x: 20, y: 0 })).toBe(true);
  });
});
