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

// 팔레트(x 0..280) 왼쪽, 캔버스(x 280..1180) 오른쪽. 스택 블록 x 300..512.
const CANVAS_LEFT = 280;
const STACK_X = CANVAS_LEFT + 20 + 100; // 스택 블록 가로 중앙 근처 (스냅 범위 안)
const FAR_X = 800; // 스택에서 가로로 멀리 (스냅 안 됨)

function stubLayout() {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-block')) {
      const siblings = this.parentElement ? Array.from(this.parentElement.children) : [];
      const idx = Math.max(0, siblings.indexOf(this));
      return makeRect(CANVAS_LEFT + 20, BLOCK_TOP + idx * (BLOCK_H + BLOCK_GAP), 212, BLOCK_H);
    }
    if (this.hasAttribute('data-block-canvas')) return makeRect(CANVAS_LEFT, 60, 900, 900);
    if (this.hasAttribute('data-block-palette')) return makeRect(0, 0, CANVAS_LEFT, 900);
    if (this.tagName === 'OL') return makeRect(CANVAS_LEFT + 20, BLOCK_TOP, 212, 400);
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

const canvas = () => screen.getByRole('region', { name: '블록 조립 캔버스' });
const canvasBlocks = () => within(canvas()).getAllByText('인사하기');
// 캔버스 첫 <ol> = 시작에 연결된 스택 (자유 그룹 <ol> 은 그 뒤에 온다)
const stackOrder = () =>
  Array.from(canvas().querySelector('ol')!.children).map((li) => li.getAttribute('data-block'));
const stackBlockByText = (text: string) => within(canvas()).getByText(text).closest('li')!;

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
    fireEvent.pointerMove(window, { clientX: STACK_X, clientY: slotCenterY(1) });
    fireEvent.pointerUp(window, { clientX: STACK_X, clientY: slotCenterY(1) });

    // 슬롯 1(시작 다음)에 인사하기가 하나 더 들어간다
    expect(canvasBlocks()).toHaveLength(2);
  });

  it('팔레트 밖(캔버스 아님)에 다시 놓으면 아무것도 안 생긴다', async () => {
    stubLayout();
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '동작' }));
    const source = screen.getByRole('button', { name: '인사하기 블록 꺼내기' });

    fireEvent.pointerDown(source, { clientX: 20, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 400 }); // 팔레트 영역 (x < 280)
    fireEvent.pointerUp(window, { clientX: 120, clientY: 400 });

    expect(canvasBlocks()).toHaveLength(1);
  });

  it('스냅 거리 밖 캔버스에 놓으면 연결 없이 자유 블록으로 남는다 (기명서)', async () => {
    stubLayout();
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '동작' }));
    const source = screen.getByRole('button', { name: '인사하기 블록 꺼내기' });

    fireEvent.pointerDown(source, { clientX: 20, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: FAR_X, clientY: 600 }); // 캔버스 안, 스택과 멀리
    fireEvent.pointerUp(window, { clientX: FAR_X, clientY: 600 });

    // 스택은 그대로(3), 자유 블록으로 인사하기 1개 추가 → 캔버스에 총 2
    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0']);
    expect(canvasBlocks()).toHaveLength(2);
  });
});

describe('팔레트 키보드 추가 + 안내', () => {
  it('팔레트 블록에서 Enter 를 누르면 스택 끝에 추가되고 스크린리더에 알린다', async () => {
    const user = userEvent.setup();
    renderView();

    await user.click(screen.getByRole('button', { name: '동작' }));
    expect(canvasBlocks()).toHaveLength(1);

    screen.getByRole('button', { name: '인사하기 블록 꺼내기' }).focus();
    await user.keyboard('{Enter}');

    expect(canvasBlocks()).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('인사하기 블록을 추가했어요.');
  });
});

describe('캔버스 블록 재정렬·자유 배치', () => {
  it('스택 블록을 다른 슬롯으로 끌면 순서가 바뀐다', () => {
    stubLayout();
    renderView();
    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0']);

    const greet = stackBlockByText('인사하기');
    fireEvent.pointerDown(greet, { clientX: STACK_X, clientY: slotCenterY(3) });
    fireEvent.pointerMove(window, { clientX: STACK_X, clientY: slotCenterY(1) });
    fireEvent.pointerUp(window, { clientX: STACK_X, clientY: slotCenterY(1) });

    expect(stackOrder()).toEqual(['start-0', 'greet-0', 'repeat-0']);
  });

  it('스택 블록을 스냅 밖 캔버스에 놓으면 스택에서 빠지고 그 자리에 남는다', () => {
    stubLayout();
    renderView();

    const greet = stackBlockByText('인사하기');
    fireEvent.pointerDown(greet, { clientX: STACK_X, clientY: slotCenterY(3) });
    fireEvent.pointerMove(window, { clientX: FAR_X, clientY: 700 }); // 캔버스 안, 스택과 멀리
    fireEvent.pointerUp(window, { clientX: FAR_X, clientY: 700 });

    // 스택에서는 빠졌지만 캔버스엔 여전히 존재 (자유 블록)
    expect(stackOrder()).toEqual(['start-0', 'repeat-0']);
    expect(within(canvas()).getByText('인사하기')).toBeInTheDocument();
  });

  it('블록을 잡으면 아래에 연결된 블록이 함께 이동한다 (기명서)', () => {
    stubLayout();
    renderView();
    // 먼저 종료를 연결해 [start, repeat, greet, end] 로 만든다
    screen.getByRole('button', { name: '종료 블록 연결하기' }).focus();
    fireEvent.keyDown(screen.getByRole('button', { name: '종료 블록 연결하기' }), { key: 'Enter' });
    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0', 'end-0']);

    // repeat 을 잡아 캔버스로 빼면 greet·end 도 함께 빠진다
    const repeat = stackBlockByText('번 반복하기');
    fireEvent.pointerDown(repeat, { clientX: STACK_X, clientY: slotCenterY(1) });
    fireEvent.pointerMove(window, { clientX: FAR_X, clientY: 750 });
    fireEvent.pointerUp(window, { clientX: FAR_X, clientY: 750 });

    expect(stackOrder()).toEqual(['start-0']);
    // repeat·greet·end 는 자유 그룹으로 캔버스에 그대로
    expect(within(canvas()).getByText('인사하기')).toBeInTheDocument();
    expect(within(canvas()).getByText('종료')).toBeInTheDocument();
  });
});
