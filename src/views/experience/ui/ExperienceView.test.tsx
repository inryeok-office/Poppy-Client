import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/shared/api/msw/server';

import { INITIAL_PROGRAM } from '../model/blockProgram';
import { ExperienceView } from './ExperienceView';

const seedDraft = (draft: Record<string, unknown>) => {
  localStorage.setItem('poppy.experience.sessionId', String(draft.sessionId));
  localStorage.setItem('poppy.experience.draft', JSON.stringify(draft));
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

const connectEndBlock = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: '종료 블록 연결하기' }));

const waitForRunButton = () =>
  waitFor(
    () => expect(screen.getByRole('button', { name: '로봇 실행하기' })).toHaveClass('bg-primary'),
    { timeout: 3000 },
  );

/** 종료 연결 → 시뮬레이션 통과까지 진행한다. */
async function passSimulation(user: ReturnType<typeof userEvent.setup>) {
  await connectEndBlock(user);
  await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));
  await waitForRunButton();
}

const executionState = (status: string, extra: Record<string, unknown> = {}) => ({
  success: true,
  data: {
    executionId: 'exec-test',
    status,
    missionCleared: status === 'completed' ? true : null,
    elapsedSec: null,
    message: status === 'completed' ? '로봇이 프로그램대로 잘 움직였어요.' : null,
    ...extra,
  },
});

describe('ExperienceView', () => {
  it('주요 영역의 앵커 텍스트를 렌더링한다', () => {
    renderView();

    expect(screen.getByRole('button', { name: '처음으로' })).toBeInTheDocument();
    expect(screen.getByText('튜토리얼')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '로봇 미리보기' })).toBeInTheDocument();
  });

  it('종료 블록이 연결되지 않으면 오류 안내와 함께 시뮬레이션이 막힌다', () => {
    renderView();

    expect(screen.getByText(/‘종료’ 블록을 연결/)).toBeInTheDocument();
    const simulate = screen.getByRole('button', { name: '시뮬레이션 하기' });
    expect(simulate).toHaveAttribute('aria-disabled');
    expect(simulate).not.toHaveClass('bg-primary');
  });

  it('떨어진 종료 블록을 연결하면 시뮬레이션이 활성화된다', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);

    const simulate = screen.getByRole('button', { name: '시뮬레이션 하기' });
    expect(simulate).toHaveClass('bg-primary');
    expect(simulate).not.toHaveAttribute('aria-disabled');
    expect(screen.queryByRole('button', { name: '종료 블록 연결하기' })).not.toBeInTheDocument();
  });

  it('시뮬레이션 통과 전에는 로봇 실행하기가 잠겨 있다', () => {
    renderView();

    const run = screen.getByRole('button', { name: /로봇 실행하기/ });
    expect(run).toHaveTextContent('잠김');
    expect(run).toHaveAttribute('aria-disabled');
  });

  it('종료 연결 → 시뮬레이션(mock API) 통과 → 로봇 실행하기 활성 + 튜토리얼 제거', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    await waitForRunButton();
    expect(screen.getByRole('button', { name: '로봇 실행하기' })).not.toHaveTextContent('잠김');
    expect(screen.queryByText('튜토리얼')).not.toBeInTheDocument();
  });

  it('이동 거리를 늘려 안전 구역을 벗어나면 위반 안내가 뜨고 통과하지 못한다', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);
    // 반복 횟수 2 → 4 (× 이동 1m = 4m > 2m 안전 구역)
    fireEvent.change(screen.getByRole('spinbutton', { name: '반복 횟수' }), {
      target: { value: '4' },
    });
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    expect(
      await screen.findByText(/안전 구역을 벗어나요/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
    // 예상 이동 거리에 계산 결과가 반영된다
    expect(screen.getByText('4.0 m')).toBeInTheDocument();
  });

  it('시뮬레이션 API가 실패하면 오류 안내를 보여주고 로봇 실행은 잠겨 있다', async () => {
    server.use(http.post('*/api/simulations', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    expect(
      await screen.findByText(/시뮬레이션에 실패/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
  });

  it('로봇 실행하기 → 실행 상태가 완료로 바뀌고 완료 안내가 뜬다', async () => {
    server.use(
      http.post('*/api/executions', () =>
        HttpResponse.json({ success: true, data: { executionId: 'exec-test' } }),
      ),
      http.get('*/api/executions/:id', () => HttpResponse.json(executionState('completed'))),
    );
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));

    expect(
      await screen.findByText(/잘 움직였어요/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
  });

  it('실행 중에는 실행 중지 버튼이 뜨고, 누르면 멈춘다', async () => {
    let cancelled = false;
    server.use(
      http.post('*/api/executions', () =>
        HttpResponse.json({ success: true, data: { executionId: 'exec-test' } }),
      ),
      http.get('*/api/executions/:id', () =>
        HttpResponse.json(executionState(cancelled ? 'cancelled' : 'running')),
      ),
      http.post('*/api/executions/:id/cancel', () => {
        cancelled = true;
        return HttpResponse.json(executionState('cancelled'));
      }),
    );
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));
    const stop = await screen.findByRole('button', { name: '실행 중지' }, { timeout: 3000 });
    await user.click(stop);

    expect(
      await screen.findByText(/실행을 멈췄어요/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('취소한 뒤 로봇 실행하기를 다시 누르면 새 실행이 시작된다', async () => {
    const requestedIds: string[] = [];
    server.use(
      http.post('*/api/executions', () => {
        const executionId = `exec-${requestedIds.length + 1}`;
        requestedIds.push(executionId);
        return HttpResponse.json({ success: true, data: { executionId } });
      }),
      http.get('*/api/executions/:id', ({ params }) =>
        HttpResponse.json(executionState(String(params.id) === 'exec-1' ? 'cancelled' : 'running')),
      ),
    );
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));
    expect(
      await screen.findByText(/실행을 멈췄어요/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));
    await waitFor(() => expect(requestedIds).toHaveLength(2), { timeout: 3000 });
    expect(
      await screen.findByText(/움직이고 있어요/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
  });

  it('진행 중 처음으로를 누르면 서버에 실행 취소를 보낸다', async () => {
    let cancelled = false;
    server.use(
      http.post('*/api/executions', () =>
        HttpResponse.json({ success: true, data: { executionId: 'exec-x' } }),
      ),
      http.get('*/api/executions/:id', () =>
        HttpResponse.json(executionState(cancelled ? 'cancelled' : 'running')),
      ),
      http.post('*/api/executions/:id/cancel', () => {
        cancelled = true;
        return HttpResponse.json(executionState('cancelled'));
      }),
    );
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));
    await screen.findByRole('button', { name: '실행 중지' }, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: '처음으로' }));

    await waitFor(() => expect(cancelled).toBe(true), { timeout: 3000 });
    expect(screen.getByRole('button', { name: '종료 블록 연결하기' })).toBeInTheDocument();
  });

  it('블록을 바꾸면 헤더에 자동 저장 상태가 뜬다', async () => {
    const user = userEvent.setup();
    renderView();
    // 세션 생성(POST /api/sessions) 대기
    await new Promise((resolve) => setTimeout(resolve, 300));

    await connectEndBlock(user);

    expect(await screen.findByText('저장 중…', undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByText('저장됨', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('저장 요청이 실패하면 오프라인 안내를 보여준다', async () => {
    server.use(
      http.put('*/api/sessions/:id/project', () => new HttpResponse(null, { status: 503 })),
    );
    const user = userEvent.setup();
    renderView();
    await new Promise((resolve) => setTimeout(resolve, 300));

    await connectEndBlock(user);

    expect(await screen.findByText(/오프라인/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('세션 생성이 실패해도 로컬 초안에 저장하고 오프라인 안내를 보여준다', async () => {
    server.use(http.post('*/api/sessions', () => new HttpResponse(null, { status: 503 })));
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);

    expect(await screen.findByText(/오프라인/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(localStorage.getItem('poppy.experience.draft')).toBeTruthy();
  });

  it('브라우저 초안이 있으면 그 상태로 복원한다', () => {
    seedDraft({
      sessionId: 'sess-restore',
      program: {
        chain: ['start', 'repeat', 'move', 'greet', 'end'],
        detached: [],
        repeatCount: 5,
        moveDistance: 1,
      },
      projectVersion: 2,
      dirty: false,
    });
    renderView();

    expect(screen.queryByRole('button', { name: '종료 블록 연결하기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toHaveClass('bg-primary');
    expect(screen.getByRole('spinbutton', { name: '반복 횟수' })).toHaveValue(5);
  });

  it('재방문 세션은 초안의 버전을 baseVersion 으로 보낸다', async () => {
    seedDraft({
      sessionId: 'sess-revisit',
      program: { ...INITIAL_PROGRAM },
      projectVersion: 3,
      dirty: false,
    });
    let sentBaseVersion = -1;
    server.use(
      http.put('*/api/sessions/:id/project', async ({ request }) => {
        sentBaseVersion = ((await request.json()) as { baseVersion: number }).baseVersion;
        return HttpResponse.json({ success: true, data: { projectVersion: sentBaseVersion + 1 } });
      }),
    );
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);

    await waitFor(() => expect(sentBaseVersion).toBe(3), { timeout: 3000 });
  });

  it('디바운스 동안 여러 번 편집하면 최신 값만 저장한다', async () => {
    const savedRepeatCounts: number[] = [];
    server.use(
      http.put('*/api/sessions/:id/project', async ({ request }) => {
        const body = (await request.json()) as { program: { repeatCount: number } };
        savedRepeatCounts.push(body.program.repeatCount);
        return HttpResponse.json({
          success: true,
          data: { projectVersion: savedRepeatCounts.length },
        });
      }),
    );
    const user = userEvent.setup();
    renderView();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await connectEndBlock(user);
    await screen.findByText('저장됨', undefined, { timeout: 3000 });

    const repeat = screen.getByRole('spinbutton', { name: '반복 횟수' });
    fireEvent.change(repeat, { target: { value: '3' } });
    fireEvent.change(repeat, { target: { value: '7' } });

    await waitFor(() => expect(savedRepeatCounts.at(-1)).toBe(7), { timeout: 3000 });
    expect(savedRepeatCounts).not.toContain(3);
  });

  it('처음으로를 누르면 블록·통과 기록이 초기화된다', async () => {
    const user = userEvent.setup();
    renderView();

    await connectEndBlock(user);
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));
    await waitForRunButton();

    await user.click(screen.getByRole('button', { name: '처음으로' }));

    expect(screen.getByRole('button', { name: '종료 블록 연결하기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
  });
});
