import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperienceView } from './ExperienceView';
import { FAR_X, STACK_X, drag, rectFor, slotCenterY } from './dragTestKit';

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rectFor);
  return render(
    <QueryClientProvider client={queryClient}>
      <ExperienceView />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.restoreAllMocks());

const canvas = () => screen.getByRole('region', { name: '블록 조립 캔버스' });
// 캔버스 첫 <ol> = 시작에 연결된 스택 (자유 그룹 <ol> 은 그 뒤에 온다)
const stackOrder = () =>
  Array.from(canvas().querySelector('ol')!.children).map((li) => li.getAttribute('data-block'));
const canvasText = (t: string) => within(canvas()).getAllByText(t);
const blockLi = (t: string) => within(canvas()).getByText(t).closest('li')!;

describe('블록 드래그 이동·스냅 연결 (기명서)', () => {
  it('팔레트 블록을 스택 슬롯 가까이 놓으면 그 자리에 연결된다', () => {
    renderView();
    const wait = screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' });

    drag(wait, STACK_X, slotCenterY(1));

    // 슬롯 1(시작 다음)에 wait 블록이 들어간다
    expect(stackOrder()).toEqual([
      'start-0',
      expect.stringContaining('wait'),
      'repeat-0',
      'greet-0',
    ]);
  });

  it('스냅 거리 밖 캔버스에 놓으면 연결 없이 자유 블록으로 남는다', () => {
    renderView();
    const wait = screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' });

    drag(wait, FAR_X, 600);

    // 스택은 그대로, 캔버스엔 자유 블록으로 "초 기다리기" 가 생김
    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0']);
    expect(canvasText('초 기다리기').length).toBe(1);
  });

  it('떨어진 종료를 스택 끝 가까이 놓으면 연결된다', () => {
    renderView();
    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0']);

    drag(blockLi('종료'), STACK_X, slotCenterY(3));

    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0', 'end-0']);
    expect(within(canvas()).queryByText('종료')).toBeInTheDocument(); // 스택 안으로 이동
    expect(canvas().querySelectorAll('[data-floating-group]').length).toBe(0);
  });

  it('스택 블록을 다른 슬롯으로 끌면 순서가 바뀐다', () => {
    renderView();

    drag(blockLi('인사하기'), STACK_X, slotCenterY(1));

    expect(stackOrder()).toEqual(['start-0', 'greet-0', 'repeat-0']);
  });

  it('블록을 잡으면 아래에 연결된 블록이 함께 이동한다', () => {
    renderView();
    // 먼저 종료를 스택에 붙여 [start, repeat, greet, end] 로
    drag(blockLi('종료'), STACK_X, slotCenterY(3));
    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0', 'end-0']);

    // repeat 을 잡아 캔버스로 빼면 greet·end 도 함께 빠진다
    drag(blockLi('번 반복하기'), FAR_X, 700);

    expect(stackOrder()).toEqual(['start-0']);
    expect(within(canvas()).getByText('인사하기')).toBeInTheDocument();
    expect(within(canvas()).getByText('종료')).toBeInTheDocument();
  });

  it('팔레트 블록을 캔버스 밖에 놓으면 아무것도 안 생긴다', () => {
    renderView();
    const wait = screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' });

    fireEvent.pointerDown(wait, { clientX: STACK_X, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 300 }); // 팔레트 영역
    fireEvent.pointerUp(window, { clientX: 40, clientY: 300 });

    expect(stackOrder()).toEqual(['start-0', 'repeat-0', 'greet-0']);
    expect(within(canvas()).queryByText('초 기다리기')).not.toBeInTheDocument();
  });
});
