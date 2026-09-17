import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/shared/api/msw/server';

import { INITIAL_PROGRAM, serializeProgram, setBlockParam } from '../model/blockProgram';
import { ExperienceView } from './ExperienceView';
import { STACK_X, drag, rectFor, slotCenterY } from './dragTestKit';

const CONNECTED_PROGRAM = {
  stack: [...INITIAL_PROGRAM.stack, { id: 'end-0', kind: 'end' as const }],
  floating: [],
};

const SERVER_COMPATIBLE_PROGRAM = {
  stack: [
    { id: 'start-0', kind: 'start' as const },
    {
      id: 'repeat-0',
      kind: 'repeat' as const,
      count: 2,
      body: [{ id: 'move-0', kind: 'move' as const, distanceM: 1 }],
    },
  ],
  floating: [
    { id: 'float-end-0', x: 325, y: 174, blocks: [{ id: 'end-0', kind: 'end' as const }] },
  ],
};

const seedDraft = (draft: Record<string, unknown>) => {
  localStorage.setItem('poppy.experience.sessionId', String(draft.sessionId));
  localStorage.setItem('poppy.experience.draft', JSON.stringify(draft));
};

afterEach(() => vi.restoreAllMocks());

function renderView() {
  if (!localStorage.getItem('poppy.experience.draft')) {
    seedDraft({
      sessionId: '',
      program: serializeProgram(SERVER_COMPATIBLE_PROGRAM),
      blocks: SERVER_COMPATIBLE_PROGRAM,
      projectVersion: 0,
      dirty: false,
    });
  }
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

// 떨어진 '종료' 블록을 스택 끝 슬롯으로 끌어 연결한다 (jsdom 레이아웃은 dragTestKit 이 스텁).
const connectEndBlock = () => {
  const region = screen.getByRole('region', { name: '블록 조립 캔버스' });
  drag(within(region).getByText('종료').closest('li')!, STACK_X, slotCenterY(3));
};

/** 캔버스에 아직 연결 안 된 자유 블록 그룹이 있는지. */
const hasFloatingBlock = () =>
  screen.getByRole('region', { name: '블록 조립 캔버스' }).querySelector('[data-floating-group]') !=
  null;

const waitForRunButton = () =>
  waitFor(
    () => expect(screen.getByRole('button', { name: '로봇 실행하기' })).toHaveClass('bg-primary'),
    { timeout: 3000 },
  );

/** 종료 연결 → 시뮬레이션 통과까지 진행한다. */
async function passSimulation(user: ReturnType<typeof userEvent.setup>) {
  connectEndBlock();
  await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));
  await waitForRunButton();
}

// Retained only as a fixture reference for the legacy view model tests.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
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

const serverExecutionState = (status: string, executionId = 'exec-test') => ({
  success: true,
  data: {
    executionId,
    sessionId: 'session-test',
    blockVersion: 1,
    status: status.toUpperCase(),
    queuePosition: status === 'queued' ? 1 : null,
    assignedRobotId: null,
    queuedAt: new Date(0).toISOString(),
    startedAt: status === 'running' || status === 'completed' ? new Date(1).toISOString() : null,
    finishedAt: status === 'completed' || status === 'cancelled' ? new Date(2).toISOString() : null,
  },
  error: null,
});

const serverExecutionRequest = (executionId: string) => ({
  success: true,
  data: {
    executionId,
    sessionId: 'session-test',
    blockVersion: 1,
    status: 'QUEUED',
    queuedAt: new Date(0).toISOString(),
  },
  error: null,
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

    expect(
      screen.getByText((content) => content.includes('종료') && content.includes('끝내')),
    ).toBeInTheDocument();
    const simulate = screen.getByRole('button', { name: '시뮬레이션 하기' });
    expect(simulate).toHaveAttribute('aria-disabled');
    expect(simulate).not.toHaveClass('bg-primary');
  });

  it('떨어진 종료 블록을 연결하면 시뮬레이션이 활성화된다', () => {
    renderView();

    connectEndBlock();

    const simulate = screen.getByRole('button', { name: '시뮬레이션 하기' });
    expect(simulate).toHaveClass('bg-primary');
    expect(simulate).not.toHaveAttribute('aria-disabled');
    expect(hasFloatingBlock()).toBe(false);
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

    connectEndBlock();
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    await waitForRunButton();
    expect(screen.getByRole('button', { name: '로봇 실행하기' })).not.toHaveTextContent('잠김');
    expect(screen.queryByText('튜토리얼')).not.toBeInTheDocument();
  });

  it('시뮬레이션 직전 아직 자동 저장되지 않은 편집이 있으면, 먼저 저장한 최신 버전으로 통과 기록을 남긴다 (코드리뷰: 버전 어긋남 방지)', async () => {
    let nextVersion = 0;
    const savedRepeatCounts: number[] = [];
    let simulationPassVersion: number | null = null;
    server.use(
      http.post('*/api/v1/sessions/:sessionId/block-revisions', async ({ request }) => {
        const body = (await request.json()) as {
          document: { blocks: Array<{ type: string; parameters?: { count?: number } }> };
        };
        const repeatNode = body.document.blocks.find((n) => n.type === 'REPEAT');
        savedRepeatCounts.push(repeatNode?.parameters?.count ?? -1);
        nextVersion += 1;
        return HttpResponse.json({
          success: true,
          data: { sessionId: 'session-test', blockVersion: nextVersion },
          error: null,
        });
      }),
      http.post('*/api/v1/sessions/:sessionId/simulation-passes', async ({ request }) => {
        const body = (await request.json()) as { blockVersion: number };
        simulationPassVersion = body.blockVersion;
        return HttpResponse.json({
          success: true,
          data: {
            sessionId: 'session-test',
            blockVersion: body.blockVersion,
            passedAt: new Date().toISOString(),
          },
          error: null,
        });
      }),
    );
    const user = userEvent.setup();
    renderView();

    connectEndBlock(); // 종료 연결 → 첫 자동 저장 (버전 1, 반복 횟수 2)
    await waitFor(() => expect(savedRepeatCounts).toEqual([2]), { timeout: 3000 });

    // 반복 횟수를 1로 바꾼다 — 600ms 디바운스가 끝나기 전에 바로 시뮬레이션한다
    fireEvent.change(screen.getByRole('spinbutton', { name: '반복 횟수' }), {
      target: { value: '1' },
    });
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    await waitFor(() => expect(simulationPassVersion).not.toBeNull(), { timeout: 3000 });
    // 디바운스를 기다리지 않고 바로 저장돼, 통과 기록이 방금 편집한(반복 1회) 버전을 가리킨다
    expect(savedRepeatCounts).toEqual([2, 1]);
    expect(simulationPassVersion).toBe(2);
  });

  it('디바운스가 이미 저장을 시작했지만 아직 안 끝난 상태에서 시뮬레이션해도, 그 저장이 끝난 최신 버전으로 통과 기록을 남긴다 (코드리뷰: 경합 방지)', async () => {
    let nextVersion = 0;
    const savedRepeatCounts: number[] = [];
    let simulationPassVersion: number | null = null;
    server.use(
      http.post('*/api/v1/sessions/:sessionId/block-revisions', async ({ request }) => {
        const body = (await request.json()) as {
          document: { blocks: Array<{ type: string; parameters?: { count?: number } }> };
        };
        const repeatNode = body.document.blocks.find((n) => n.type === 'REPEAT');
        const count = repeatNode?.parameters?.count ?? -1;
        savedRepeatCounts.push(count);
        nextVersion += 1;
        const version = nextVersion;
        if (count === 1) {
          // 두 번째 저장(반복 횟수 1로 편집)만 일부러 느리게 응답해, "저장을 시작했지만
          // 아직 안 끝난" 경합 구간을 만든다.
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        return HttpResponse.json({
          success: true,
          data: { sessionId: 'session-test', blockVersion: version },
          error: null,
        });
      }),
      http.post('*/api/v1/sessions/:sessionId/simulation-passes', async ({ request }) => {
        const body = (await request.json()) as { blockVersion: number };
        simulationPassVersion = body.blockVersion;
        return HttpResponse.json({
          success: true,
          data: {
            sessionId: 'session-test',
            blockVersion: body.blockVersion,
            passedAt: new Date().toISOString(),
          },
          error: null,
        });
      }),
    );
    renderView();

    connectEndBlock(); // 종료 연결 → 첫 자동 저장 (버전 1, 반복 횟수 2)
    await waitFor(() => expect(savedRepeatCounts).toEqual([2]), { timeout: 3000 });

    fireEvent.change(screen.getByRole('spinbutton', { name: '반복 횟수' }), {
      target: { value: '1' },
    });
    // 600ms 디바운스가 스스로 저장을 "시작"할 때까지 기다린다 — 응답은 아직 안 왔다(150ms 지연 중).
    await waitFor(() => expect(savedRepeatCounts).toEqual([2, 1]), { timeout: 3000 });

    // 저장이 진행 중인 바로 이 순간 시뮬레이션한다 — fireEvent 로 클릭해 await 없이 바로 이어간다.
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    await waitFor(() => expect(simulationPassVersion).not.toBeNull(), { timeout: 3000 });
    // 진행 중이던 저장에 올라탔을 뿐, 새로 큐에 넣지 않았다
    expect(savedRepeatCounts).toEqual([2, 1]);
    // 디바운스가 끝낸 최신 버전(2)을 썼다 — 저장 시작 전의 값(1)이 아니라
    expect(simulationPassVersion).toBe(2);
  });

  it('이동 거리를 늘려 안전 구역을 벗어나면 위반 안내가 뜨고 통과하지 못한다', async () => {
    const user = userEvent.setup();
    renderView();

    connectEndBlock();
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
    server.use(
      http.post(
        '*/api/v1/sessions/:sessionId/simulation-passes',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderView();

    connectEndBlock();
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));

    expect(
      await screen.findByText(/시뮬레이션에 실패/, undefined, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
  });

  it('로봇 실행하기 → 실행 상태가 완료로 바뀌고 완료 안내가 뜬다', async () => {
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));

    expect(await screen.findByText(/완료했어요/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '완료' })).toBeInTheDocument();
  });

  it('배정 대기(ASSIGNED) 중에는 실행 중지 버튼이 뜨고, 누르면 멈춘다', async () => {
    let cancelled = false;
    server.use(
      http.post('*/api/v1/sessions/:sessionId/executions', () =>
        HttpResponse.json(serverExecutionRequest('exec-test')),
      ),
      http.get('*/api/v1/executions/:id', () =>
        HttpResponse.json(serverExecutionState(cancelled ? 'cancelled' : 'assigned')),
      ),
      http.post('*/api/v1/executions/:id/cancel', () => {
        cancelled = true;
        return HttpResponse.json(serverExecutionState('cancelled'));
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

  it('실행 중(RUNNING)에는 중지 버튼이 없다 — 명세: RUNNING 이후 중지는 관리자 기능', async () => {
    server.use(
      http.post('*/api/v1/sessions/:sessionId/executions', () =>
        HttpResponse.json(serverExecutionRequest('exec-test')),
      ),
      http.get('*/api/v1/executions/:id', () => HttpResponse.json(serverExecutionState('running'))),
    );
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));

    const running = await screen.findByRole('button', { name: '실행 중…' }, { timeout: 3000 });
    expect(running).toHaveAttribute('aria-disabled');
    expect(screen.queryByRole('button', { name: '실행 중지' })).not.toBeInTheDocument();
  });

  it('취소한 뒤 로봇 실행하기를 다시 누르면 새 실행이 시작된다', async () => {
    const requestedIds: string[] = [];
    server.use(
      http.post('*/api/v1/sessions/:sessionId/executions', () => {
        const executionId = `exec-${requestedIds.length + 1}`;
        requestedIds.push(executionId);
        return HttpResponse.json(serverExecutionRequest(executionId));
      }),
      http.get('*/api/v1/executions/:id', ({ params }) =>
        HttpResponse.json(
          serverExecutionState(
            String(params.id) === 'exec-1' ? 'cancelled' : 'running',
            String(params.id),
          ),
        ),
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
      http.post('*/api/v1/sessions/:sessionId/executions', () =>
        HttpResponse.json(serverExecutionRequest('exec-x')),
      ),
      http.get('*/api/v1/executions/:id', () =>
        HttpResponse.json(serverExecutionState(cancelled ? 'cancelled' : 'running')),
      ),
      http.post('*/api/v1/executions/:id/cancel', () => {
        cancelled = true;
        return HttpResponse.json(serverExecutionState('cancelled'));
      }),
    );
    const user = userEvent.setup();
    renderView();
    await passSimulation(user);

    await user.click(screen.getByRole('button', { name: '로봇 실행하기' }));
    // RUNNING 중엔 중지 버튼이 없다 — 진행 중 상태(힌트 문구)로 대기한다.
    await screen.findByText(/움직이고 있어요/, undefined, { timeout: 3000 });

    await user.click(screen.getByRole('button', { name: '처음으로' }));

    await waitFor(() => expect(cancelled).toBe(true), { timeout: 3000 });
    expect(hasFloatingBlock()).toBe(true);
  });

  it('블록을 바꾸면 헤더에 자동 저장 상태가 뜬다', async () => {
    renderView();
    // 세션 생성(POST /api/sessions) 대기
    await new Promise((resolve) => setTimeout(resolve, 300));

    connectEndBlock();

    expect(await screen.findByText('저장됨', undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('저장 요청이 실패하면 오프라인 안내를 보여준다', async () => {
    server.use(
      http.post(
        '*/api/v1/sessions/:sessionId/block-revisions',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    renderView();
    await new Promise((resolve) => setTimeout(resolve, 300));

    connectEndBlock();

    expect(await screen.findByText(/오프라인/, undefined, { timeout: 3000 })).toBeInTheDocument();
  });

  it('세션 생성이 실패해도 로컬 초안에 저장하고 오프라인 안내를 보여준다', async () => {
    server.use(http.post('*/api/v1/sessions', () => new HttpResponse(null, { status: 503 })));
    renderView();

    connectEndBlock();

    expect(await screen.findByText(/오프라인/, undefined, { timeout: 3000 })).toBeInTheDocument();
    expect(localStorage.getItem('poppy.experience.draft')).toBeTruthy();
  });

  it('브라우저 초안이 있으면 그 상태로 복원한다', () => {
    const restored = setBlockParam(CONNECTED_PROGRAM, 'repeat-0', { count: 5 });
    seedDraft({
      sessionId: 'sess-restore',
      program: serializeProgram(restored),
      blocks: restored,
      projectVersion: 2,
      dirty: false,
    });
    renderView();

    expect(hasFloatingBlock()).toBe(false);
    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toHaveClass('bg-primary');
    expect(screen.getByRole('spinbutton', { name: '반복 횟수' })).toHaveValue(5);
  });

  it('재방문 세션은 초안의 버전을 baseVersion 으로 보낸다', async () => {
    seedDraft({
      sessionId: 'sess-revisit',
      program: serializeProgram(SERVER_COMPATIBLE_PROGRAM),
      blocks: SERVER_COMPATIBLE_PROGRAM,
      projectVersion: 3,
      dirty: false,
    });
    let sentSchemaVersion = -1;
    server.use(
      http.post('*/api/v1/sessions/:sessionId/block-revisions', async ({ request }) => {
        const body = (await request.json()) as { document: { schemaVersion: number } };
        sentSchemaVersion = body.document.schemaVersion;
        return HttpResponse.json({
          success: true,
          data: { sessionId: 'sess-revisit', blockVersion: 4 },
          error: null,
        });
      }),
    );
    renderView();

    connectEndBlock();

    await waitFor(() => expect(sentSchemaVersion).toBe(1), { timeout: 3000 });
  });

  it('디바운스 동안 여러 번 편집하면 최신 값만 저장한다', async () => {
    const savedRepeatCounts: number[] = [];
    server.use(
      http.post('*/api/v1/sessions/:sessionId/block-revisions', async ({ request }) => {
        const body = (await request.json()) as {
          document: {
            blocks: Array<{ type: string; parameters?: { count?: number } }>;
          };
        };
        const repeatNode = body.document.blocks.find((n) => n.type === 'REPEAT');
        savedRepeatCounts.push(repeatNode?.parameters?.count ?? -1);
        return HttpResponse.json({
          success: true,
          data: { sessionId: 'session-test', blockVersion: savedRepeatCounts.length },
          error: null,
        });
      }),
    );
    renderView();
    await new Promise((resolve) => setTimeout(resolve, 300));
    connectEndBlock();
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

    connectEndBlock();
    await user.click(screen.getByRole('button', { name: '시뮬레이션 하기' }));
    await waitForRunButton();

    await user.click(screen.getByRole('button', { name: '처음으로' }));

    expect(hasFloatingBlock()).toBe(true);
    expect(screen.getByRole('button', { name: /로봇 실행하기/ })).toHaveTextContent('잠김');
  });
});
