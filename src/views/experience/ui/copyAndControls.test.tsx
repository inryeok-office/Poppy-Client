import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, UNKNOWN_ERROR_MESSAGE, describeError, describeErrorCode } from '@/shared/api';

import { BlockDragProvider } from '../lib/useBlockDrag';
import { INITIAL_PROGRAM } from '../model/blockProgram';
import { ExperienceView } from './ExperienceView';
import { RunReadyWorkspace } from './RunReadyWorkspace';
import { rectFor } from './dragTestKit';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe('문구·버튼 정리', () => {
  it('잠긴 로봇 실행하기에 "시뮬레이션을 통과하면 열려요" 안내가 붙는다', () => {
    renderView();
    const run = screen.getByRole('button', { name: /로봇 실행하기/ });
    expect(run).toHaveAttribute('title', '시뮬레이션을 통과하면 열려요');
    expect(screen.getAllByText('시뮬레이션을 통과하면 열려요').length).toBeGreaterThan(0);
  });

  it('처음으로는 블록을 비우고 체험 첫 화면(/)으로 이동한다', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(push).toHaveBeenCalledWith('/');
    expect(screen.getByText('체험 첫 화면으로 돌아가요 (블록은 지워져요)')).toBeInTheDocument();
  });

  it('전체 지우기는 시작·종료만 남기고 화면에 머문다', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '흐름' }));
    fireEvent.keyDown(screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' }), {
      key: 'Enter',
    });
    const canvas = screen.getByRole('region', { name: '블록 조립 캔버스' });
    expect(canvas.querySelectorAll('li[data-kind="wait"]').length).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: '전체 지우기' }));

    expect(
      Array.from(canvas.querySelector('ol')!.children).map((li) => li.getAttribute('data-kind')),
    ).toEqual(['start', 'end']);
    expect(push).not.toHaveBeenCalled();
  });

  it('튜토리얼 건너뛰기를 누르면 예시가 접히고 다시 펼칠 수 있다', () => {
    renderView();
    expect(screen.getByTestId('tutorial-example')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }));
    expect(screen.getByTestId('tutorial-example')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '튜토리얼 보기' }));
    expect(screen.getByTestId('tutorial-example')).toBeVisible();
  });

  it('이동 블록 순서는 앞으로 → 뒤로 → 오른쪽 → 왼쪽 → 정지', () => {
    renderView();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    const palette = screen.getByRole('complementary', { name: '블록 팔레트' });
    const names = within(palette)
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((n): n is string => n?.endsWith('꺼내기') ?? false);
    expect(names).toEqual([
      '앞으로 이동 블록 꺼내기',
      '뒤로 이동 블록 꺼내기',
      '오른쪽으로 회전 블록 꺼내기',
      '왼쪽으로 회전 블록 꺼내기',
      '정지 블록 꺼내기',
    ]);
    expect(within(palette).getByText('동작을 마치고 멈춰요 (비상정지 아님)')).toBeInTheDocument();
  });
});

describe('실행 안내 문구', () => {
  const renderRun = (props: Parameters<typeof RunReadyWorkspace>[0]) =>
    render(
      <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
        <RunReadyWorkspace {...props} />
      </BlockDragProvider>,
    );

  it('RUNNING 중에는 진행요원 안내를 보여준다', () => {
    renderRun({ program: INITIAL_PROGRAM, executionStatus: 'running' });
    expect(
      screen.getByText('로봇이 움직이는 중이에요. 멈춰야 하면 진행요원에게 말해 주세요.'),
    ).toBeInTheDocument();
  });

  it('실패는 진행요원 안내, 요청 오류는 코드별 한국어 문구', () => {
    const { unmount } = renderRun({ program: INITIAL_PROGRAM, executionStatus: 'failed' });
    expect(screen.getByText(UNKNOWN_ERROR_MESSAGE)).toBeInTheDocument();
    unmount();
    renderRun({
      program: INITIAL_PROGRAM,
      errorMessage: describeError(new ApiError('x', 409, 'EXECUTION_SESSION_ACTIVE')),
    });
    expect(screen.getByText(/이미 실행 중인 프로그램이 있어요/)).toBeInTheDocument();
  });

  it('모르는 코드는 진행요원 안내로 통일한다', () => {
    expect(describeErrorCode('SOMETHING_NEW')).toBe(UNKNOWN_ERROR_MESSAGE);
    expect(describeError(new Error('network'))).toBe(UNKNOWN_ERROR_MESSAGE);
  });
});
