import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperienceView } from './ExperienceView';
import {
  FAR_X,
  MOUTH_TOP,
  STACK_X,
  TRASH_X,
  TRASH_Y,
  drag,
  rectFor,
  slotCenterY,
} from './dragTestKit';

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
// 캔버스 첫 <ol> = 시작~종료 스택 (반복 입 <ol> 은 그 안에, 자유 그룹 <ol> 은 그 뒤에 온다)
const stackKinds = () =>
  Array.from(canvas().querySelector('ol')!.children).map((li) => li.getAttribute('data-kind'));
const nestedKinds = () =>
  Array.from(canvas().querySelectorAll('li[data-parent]:not([data-parent="root"])')).map((li) =>
    li.getAttribute('data-kind'),
  );
const blockLi = (t: string) => within(canvas()).getByText(t).closest('li')!;
const palette = (name: string) => screen.getByRole('button', { name });

/** 스택 블록 n개(시작 포함) 다음, 즉 종료 바로 앞 슬롯 (dragTestKit 레이아웃 기준). */
const beforeEnd = (blocksAboveEnd: number) => slotCenterY(blocksAboveEnd);

describe('블록 드래그 — 시작·종료 고정 Entry', () => {
  it('처음 캔버스는 시작 → 종료뿐이고, 팔레트에는 시작·종료가 없다', () => {
    renderView();
    expect(stackKinds()).toEqual(['start', 'end']);
    expect(screen.queryByRole('button', { name: '시작' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /종료 블록/ })).not.toBeInTheDocument();
  });

  it('팔레트 블록을 시작과 종료 사이 슬롯에 놓으면 연결된다', () => {
    renderView();
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, slotCenterY(1));
    expect(stackKinds()).toEqual(['start', 'wait', 'end']);
  });

  it('스냅 거리 밖 캔버스에 놓으면 자유 블록으로 남는다', () => {
    renderView();
    drag(palette('초 기다리기 블록 꺼내기'), FAR_X, 600);
    expect(stackKinds()).toEqual(['start', 'end']);
    expect(canvas().querySelectorAll('[data-floating-group]').length).toBe(1);
  });

  it('시작·종료는 잡아도 움직이지 않는다', () => {
    renderView();
    drag(blockLi('종료'), FAR_X, 600);
    drag(blockLi('시작'), TRASH_X, TRASH_Y);
    expect(stackKinds()).toEqual(['start', 'end']);
    expect(canvas().querySelectorAll('[data-floating-group]').length).toBe(0);
  });

  it('스택 블록을 다른 슬롯으로 끌면 순서가 바뀌고 종료는 끝에 남는다', () => {
    renderView();
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, slotCenterY(1));
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    drag(palette('앞으로 이동 블록 꺼내기'), STACK_X, beforeEnd(2));
    expect(stackKinds()).toEqual(['start', 'wait', 'moveForward', 'end']);

    // 앞으로 이동(형제 인덱스 2)을 잡으면 남은 레이아웃은 시작(100)·기다리기(146)·종료(238)
    // → 슬롯 1 의 중점 (144 + 146) / 2 = 145
    drag(canvas().querySelector('li[data-kind="moveForward"]')!, STACK_X, 145);
    expect(stackKinds()).toEqual(['start', 'moveForward', 'wait', 'end']);
  });

  it('블록을 잡으면 아래에 연결된 블록이 함께 빠지지만 종료는 남는다', () => {
    renderView();
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, slotCenterY(1));
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    drag(palette('앞으로 이동 블록 꺼내기'), STACK_X, beforeEnd(2));

    drag(blockLi('초 기다리기'), FAR_X, 700);

    expect(stackKinds()).toEqual(['start', 'end']);
    const group = canvas().querySelector('[data-floating-group]')!;
    expect(Array.from(group.querySelectorAll('li')).map((li) => li.dataset.kind)).toEqual([
      'wait',
      'moveForward',
    ]);
  });

  it('팔레트 블록을 캔버스 밖에 놓으면 아무것도 안 생긴다', () => {
    renderView();
    const wait = palette('초 기다리기 블록 꺼내기');
    fireEvent.pointerDown(wait, { clientX: STACK_X, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 40, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 40, clientY: 300 });
    expect(stackKinds()).toEqual(['start', 'end']);
  });
});

describe('반복 블록 입 — 넣기·빼기 (Notion 블록 편집기 명세)', () => {
  const addRepeat = () => drag(palette('번 반복하기 블록 꺼내기'), STACK_X, slotCenterY(1));

  it('빈 반복은 입에 오류 안내가 보이고 시뮬레이션이 막힌다', () => {
    renderView();
    addRepeat();
    expect(stackKinds()).toEqual(['start', 'repeat', 'end']);
    expect(within(canvas()).getByText('반복할 블록을 넣어 주세요')).toBeInTheDocument();
    expect(screen.getByText(/빈 반복 블록이 있어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toHaveAttribute(
      'aria-disabled',
    );
  });

  it('팔레트 블록을 반복 입에 넣고, 다시 스택으로 빼낸다', () => {
    renderView();
    addRepeat();

    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, MOUTH_TOP + 12);
    expect(nestedKinds()).toEqual(['wait']);
    expect(stackKinds()).toEqual(['start', 'repeat', 'end']);
    expect(within(canvas()).queryByText('반복할 블록을 넣어 주세요')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).not.toHaveAttribute(
      'aria-disabled',
    );

    // 입 안 기다리기를 잡아 반복 다음(종료 앞) 슬롯으로 — 스택: 시작(100)·반복(146)·종료(192)
    drag(blockLi('초 기다리기'), STACK_X, slotCenterY(2));
    expect(nestedKinds()).toEqual([]);
    expect(stackKinds()).toEqual(['start', 'repeat', 'wait', 'end']);
  });

  it('반복 안에 반복은 넣을 수 없다', () => {
    renderView();
    addRepeat();

    drag(palette('번 반복하기 블록 꺼내기'), STACK_X, MOUTH_TOP + 12);

    expect(nestedKinds()).toEqual([]);
    expect(stackKinds()).toEqual(['start', 'repeat', 'end']);
  });

  it('반복 블록을 옮기면 입 안 블록도 함께 움직인다', () => {
    renderView();
    addRepeat();
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, MOUTH_TOP + 12);

    drag(blockLi('번 반복하기'), FAR_X, 600);

    expect(stackKinds()).toEqual(['start', 'end']);
    const group = canvas().querySelector('[data-floating-group]')!;
    expect(group.querySelector('li[data-kind="wait"]')).not.toBeNull();
  });

  it('반복 블록 높이는 입 안 블록 수만큼 늘어난다', () => {
    renderView();
    addRepeat();
    const repeatShape = () =>
      blockLi('번 반복하기').querySelector<HTMLElement>('div[style]')!.style.height;
    expect(repeatShape()).toBe('106px');

    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, MOUTH_TOP + 12);
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, MOUTH_TOP + 12);

    expect(nestedKinds()).toEqual(['wait', 'wait']);
    expect(repeatShape()).toBe('148px');
  });
});

describe('블록 삭제 — 쓰레기통 드래그 (기명서)', () => {
  it('쓰레기통에 드롭하면 블록이 삭제된다', () => {
    renderView();
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, slotCenterY(1));
    drag(blockLi('초 기다리기'), TRASH_X, TRASH_Y);
    expect(stackKinds()).toEqual(['start', 'end']);
  });

  it('감지 영역 밖에서 드롭하면 삭제하지 않고 자유 블록으로 남는다', () => {
    renderView();
    drag(palette('초 기다리기 블록 꺼내기'), STACK_X, slotCenterY(1));
    drag(blockLi('초 기다리기'), FAR_X, 600);
    expect(stackKinds()).toEqual(['start', 'end']);
    expect(within(canvas()).getByText('초 기다리기')).toBeInTheDocument();
  });
});
