import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperienceView } from './ExperienceView';

// jsdom 은 레이아웃이 없어 드래그 스냅 좌표를 계산할 수 없다.
// 캔버스 스택 블록([data-block])에 세로로 겹치지 않는 가짜 사각형을 물려 실제 포인터 드래그를 태운다.
const BLOCK_TOP = 100;
const BLOCK_H = 44;
const BLOCK_GAP = 2;

const makeRect = (left: number, top: number, width: number, height: number): DOMRect =>
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

function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-block')) {
      const siblings = this.parentElement ? Array.from(this.parentElement.children) : [];
      const idx = Math.max(0, siblings.indexOf(this));
      return makeRect(60, BLOCK_TOP + idx * (BLOCK_H + BLOCK_GAP), 212, BLOCK_H);
    }
    if (this.tagName === 'OL') return makeRect(60, BLOCK_TOP, 212, 400);
    return makeRect(0, 0, 120, 40);
  });
}

/** 슬롯 i 의 중심 Y (blockDrag.slotsFromBlockRects 와 같은 계산). */
const slotCenterY = (i: number) => {
  const prevBottom = BLOCK_TOP + (i - 1) * (BLOCK_H + BLOCK_GAP) + BLOCK_H;
  const nextTop = BLOCK_TOP + i * (BLOCK_H + BLOCK_GAP);
  return (prevBottom + nextTop) / 2;
};

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExperienceView />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const canvasBlocks = () =>
  within(screen.getByRole('region', { name: '블록 조립 캔버스' })).getAllByText('인사하기');

describe('블록 팔레트 드래그 삽입', () => {
  it('팔레트 블록을 스택 슬롯 가까이 끌어 놓으면 그 자리에 삽입된다', async () => {
    stubLayout();
    const user = userEvent.setup();
    renderView();

    // 동작 카테고리 → 인사하기 블록 노출
    await user.click(screen.getByRole('button', { name: '동작' }));
    const source = screen.getByRole('button', { name: '인사하기 블록 꺼내기' });
    expect(canvasBlocks()).toHaveLength(1); // 스택에 이미 1개

    fireEvent.pointerDown(source, { clientX: 20, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: slotCenterY(1) });
    fireEvent.pointerUp(window, { clientX: 120, clientY: slotCenterY(1) });

    // 슬롯 1(시작 다음)에 인사하기가 하나 더 들어간다
    expect(canvasBlocks()).toHaveLength(2);
  });

  it('어느 슬롯과도 멀면 아무것도 삽입되지 않는다', async () => {
    stubLayout();
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '동작' }));
    const source = screen.getByRole('button', { name: '인사하기 블록 꺼내기' });

    fireEvent.pointerDown(source, { clientX: 20, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 4000 });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 4000 });

    expect(canvasBlocks()).toHaveLength(1);
  });
});
