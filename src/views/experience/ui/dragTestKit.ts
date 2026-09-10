import { fireEvent } from '@testing-library/react';

// jsdom 은 레이아웃이 없어 드래그 스냅 좌표를 계산할 수 없다.
// 캔버스 스택 블록([data-block])·캔버스·<ol> 에 세로로 겹치지 않는 가짜 사각형을 물려
// 실제 포인터 이벤트로 드래그를 태운다. (vi.spyOn(HTMLElement.prototype,'getBoundingClientRect') 에 rectFor)

const BLOCK_TOP = 100;
const BLOCK_H = 44;
const BLOCK_GAP = 2;

export const CANVAS_LEFT = 280;
export const STACK_LEFT = CANVAS_LEFT + 20;
export const STACK_X = STACK_LEFT + 100; // 스택 블록 가로 중앙 근처 (스냅 범위 안)
export const FAR_X = 800; // 스택에서 가로로 멀리 (스냅 안 됨)

const rect = (left: number, top: number, width: number, height: number): DOMRect =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

export function rectFor(this: HTMLElement): DOMRect {
  if (this.hasAttribute('data-block')) {
    const siblings = this.parentElement ? Array.from(this.parentElement.children) : [];
    const idx = Math.max(0, siblings.indexOf(this));
    return rect(STACK_LEFT, BLOCK_TOP + idx * (BLOCK_H + BLOCK_GAP), 212, BLOCK_H);
  }
  if (this.hasAttribute('data-block-canvas')) return rect(CANVAS_LEFT, 60, 900, 900);
  if (this.tagName === 'OL') return rect(STACK_LEFT, BLOCK_TOP, 212, 400);
  return rect(0, 0, 120, 40);
}

/** 슬롯 i(1..n) 의 중심 Y — blockDrag.slotsFromBlockRects 와 같은 계산. */
export const slotCenterY = (i: number) => {
  const prevBottom = BLOCK_TOP + (i - 1) * (BLOCK_H + BLOCK_GAP) + BLOCK_H;
  const nextTop = BLOCK_TOP + i * (BLOCK_H + BLOCK_GAP);
  return (prevBottom + nextTop) / 2;
};

/** source 요소를 잡아 (x, y) 로 끌어 놓는다. */
export function drag(source: Element, x: number, y: number) {
  fireEvent.pointerDown(source, { clientX: STACK_X, clientY: 500 });
  fireEvent.pointerMove(window, { clientX: x, clientY: y });
  fireEvent.pointerUp(window, { clientX: x, clientY: y });
}
