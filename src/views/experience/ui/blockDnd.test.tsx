import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExperienceView } from './ExperienceView';
import { FAR_X, STACK_X, TRASH_X, TRASH_Y, drag, rectFor, slotCenterY } from './dragTestKit';

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

describe('블록 삭제 — 쓰레기통 드래그 (기명서)', () => {
  it('쓰레기통에 드롭하면 블록이 삭제된다', () => {
    renderView();

    drag(blockLi('인사하기'), TRASH_X, TRASH_Y);

    expect(stackOrder()).toEqual(['start-0', 'repeat-0']);
    expect(within(canvas()).queryByText('인사하기')).not.toBeInTheDocument();
  });

  it('연결된 블록 묶음을 쓰레기통에 놓으면 아래로 딸려온 블록도 같이 삭제된다', () => {
    renderView();

    // repeat 을 잡으면 greet 도 함께 딸려온다 — 쓰레기통에 놓으면 둘 다 사라진다
    drag(blockLi('번 반복하기'), TRASH_X, TRASH_Y);

    expect(stackOrder()).toEqual(['start-0']);
    expect(within(canvas()).queryByText('인사하기')).not.toBeInTheDocument();
  });

  it('감지 영역(시각 영역 바깥 30px) 밖에서 드롭하면 삭제하지 않는다', () => {
    renderView();

    // 쓰레기통에서 충분히 먼 스냅 밖 지점 — 삭제되지 않고 자유 블록으로 남는다
    drag(blockLi('인사하기'), FAR_X, 600);

    expect(stackOrder()).toEqual(['start-0', 'repeat-0']);
    expect(within(canvas()).getByText('인사하기')).toBeInTheDocument();
  });
});

describe('카테고리 전환 — 이동·동작 블록 팔레트 (Figma Slide 5 카탈로그)', () => {
  it('기본은 흐름 카테고리만 보이고, 다른 카테고리 블록은 없다', () => {
    renderView();
    expect(
      screen.queryByRole('button', { name: '앞으로 이동 블록 꺼내기' }),
    ).not.toBeInTheDocument();
  });

  it('이동 카테고리를 누르면 새 이동 블록(뒤로·앞으로·회전·정지)을 꺼낼 수 있다', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));

    const forward = screen.getByRole('button', { name: '앞으로 이동 블록 꺼내기' });
    drag(forward, STACK_X, slotCenterY(1));

    expect(stackOrder()).toEqual([
      'start-0',
      expect.stringContaining('moveForward'),
      'repeat-0',
      'greet-0',
    ]);
    // 카테고리를 전환했으니 흐름 블록은 더 이상 안 보인다
    expect(
      screen.queryByRole('button', { name: '초 기다리기 블록 꺼내기' }),
    ).not.toBeInTheDocument();
  });

  it('동작 카테고리를 누르면 새 동작 블록(춤추기 등)을 꺼낼 수 있다', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '동작' }));

    const dance = screen.getByRole('button', { name: '춤추기 블록 꺼내기' });
    drag(dance, STACK_X, slotCenterY(1));

    expect(stackOrder()).toEqual([
      'start-0',
      expect.stringContaining('dance'),
      'repeat-0',
      'greet-0',
    ]);
  });
});

describe('시작 카테고리 — 시작·종료 중복 생성 방지 (inryeok-bot 리뷰)', () => {
  it('시작은 그림만 보여주고 팔레트에서 꺼낼 수 없다 (프로그램에 정확히 하나만 있어야 한다)', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));

    const list = screen.getByRole('list', { name: '선택된 카테고리 블록' });
    expect(
      within(list).queryByRole('button', { name: '시작 블록 꺼내기' }),
    ).not.toBeInTheDocument();
    expect(within(list).getByText('시작')).toBeInTheDocument();
  });

  it('종료가 이미 있으면(기본 상태) 종료도 그림만 보여주고 꺼낼 수 없다', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '시작' }));

    const list = screen.getByRole('list', { name: '선택된 카테고리 블록' });
    expect(
      within(list).queryByRole('button', { name: '종료 블록 꺼내기' }),
    ).not.toBeInTheDocument();
    expect(within(list).getByText('종료')).toBeInTheDocument();
  });

  it('종료를 쓰레기통으로 지우면 그 뒤엔 팔레트에서 다시 꺼낼 수 있다', () => {
    renderView();

    // 기본 상태의 떨어진 종료를 쓰레기통에 드롭 — 프로그램에서 완전히 사라진다
    drag(blockLi('종료'), TRASH_X, TRASH_Y);
    expect(within(canvas()).queryByText('종료')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '시작' }));
    const list = screen.getByRole('list', { name: '선택된 카테고리 블록' });
    const endButton = within(list).getByRole('button', { name: '종료 블록 꺼내기' });

    drag(endButton, STACK_X, slotCenterY(3));

    expect(stackOrder()).toEqual([
      'start-0',
      'repeat-0',
      'greet-0',
      expect.stringContaining('end'),
    ]);
  });
});
