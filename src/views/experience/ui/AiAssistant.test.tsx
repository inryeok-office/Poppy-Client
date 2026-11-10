import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AiProgramDraft } from '@/features/ai';
import { server } from '@/shared/api/msw/server';

import { AiAssistant, aiSourceLabel } from './AiAssistant';

afterEach(() => {
  vi.unstubAllEnvs();
});

function renderAssistant(props: Partial<Parameters<typeof AiAssistant>[0]> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  const onApplyDraft = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <AiAssistant hideForRun={false} hintRequest={null} onApplyDraft={onApplyDraft} {...props} />
    </QueryClientProvider>,
  );
  return { onApplyDraft };
}

describe('AiAssistant', () => {
  it('off 모드면 아예 렌더하지 않는다', () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'off');
    renderAssistant();
    expect(screen.queryByText('AI 도우미')).not.toBeInTheDocument();
  });

  it('실행 화면(hideForRun)에서는 숨긴다', () => {
    renderAssistant({ hideForRun: true });
    expect(screen.queryByText('AI 도우미')).not.toBeInTheDocument();
  });

  it('만들기 전에는 onApplyDraft 를 부르지 않고, 넣어야 반영된다', async () => {
    const user = userEvent.setup();
    const { onApplyDraft } = renderAssistant();

    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await user.type(screen.getByLabelText('말로 블록 만들기 입력'), '네모를 그리면서 걸어 줘');
    await user.click(screen.getByRole('button', { name: '블록으로 만들기' }));

    await screen.findByText('캔버스에 넣기');
    expect(onApplyDraft).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: '캔버스에 넣기' }));
    expect(onApplyDraft).toHaveBeenCalledTimes(1);
    const draft = onApplyDraft.mock.calls[0][0] as AiProgramDraft;
    expect(draft.steps.length).toBeGreaterThan(0);
  });

  it('못 알아들은 문장이면 안내 문구를 보여준다', async () => {
    const user = userEvent.setup();
    renderAssistant();

    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await user.type(screen.getByLabelText('말로 블록 만들기 입력'), 'asdf qwer 1234');
    await user.click(screen.getByRole('button', { name: '블록으로 만들기' }));

    await screen.findByText(/말해 볼래요/);
    expect(screen.queryByText('캔버스에 넣기')).not.toBeInTheDocument();
  });

  it('시뮬레이션 실패가 아니면 힌트 섹션이 보이지 않는다', async () => {
    const user = userEvent.setup();
    renderAssistant({ hintRequest: null });
    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    expect(screen.queryByText(/힌트를 생각하고 있어요/)).not.toBeInTheDocument();
  });

  it('시뮬레이션이 실패하면 힌트를 보여준다', async () => {
    const user = userEvent.setup();
    renderAssistant({
      hintRequest: {
        programLines: ['앞으로 1m 이동'],
        violationCode: 'exceeds-safe-zone',
        violationMessage: '4번째 블록에서 안전 구역 밖으로 나가요.',
        violationBlockNumber: 4,
      },
    });
    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await waitFor(() => expect(screen.getByText(/4번째 블록/)).toBeInTheDocument());
  });

  it('local 모드 초안에는 "기본 규칙" 출처를 보여준다', async () => {
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await user.type(screen.getByLabelText('말로 블록 만들기 입력'), '네모를 그리면서 걸어 줘');
    await user.click(screen.getByRole('button', { name: '블록으로 만들기' }));
    expect(await screen.findByTestId('ai-draft-source')).toHaveTextContent(
      '기본 규칙으로 만들었어요',
    );
  });

  it('remote 모드에서 Server 가 성공하면 "AI 모델" 출처를 보여준다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    server.use(
      http.post('*/api/v1/ai/program-drafts', () =>
        HttpResponse.json({
          success: true,
          data: { steps: [{ kind: 'greet' }], explanation: '인사하는 블록을 만들었어요.' },
          error: null,
        }),
      ),
    );
    const user = userEvent.setup();
    renderAssistant();
    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await user.type(screen.getByLabelText('말로 블록 만들기 입력'), '인사해 줘');
    await user.click(screen.getByRole('button', { name: '블록으로 만들기' }));
    expect(await screen.findByTestId('ai-draft-source')).toHaveTextContent('AI 모델이 만들었어요');
    expect(screen.getByText('인사하는 블록을 만들었어요.')).toBeInTheDocument();
  });

  it('remote 모드에서 Server 가 503 이면 로컬 규칙 초안과 "연결하지 못해" 출처를 보여주고, 넣어야 반영된다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    server.use(
      http.post('*/api/v1/ai/program-drafts', () =>
        HttpResponse.json(
          {
            success: false,
            data: null,
            error: { code: 'AI_UNAVAILABLE', message: 'x', fieldErrors: [] },
          },
          { status: 503 },
        ),
      ),
    );
    const user = userEvent.setup();
    const { onApplyDraft } = renderAssistant();
    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await user.type(screen.getByLabelText('말로 블록 만들기 입력'), '네모를 그리면서 걸어 줘');
    await user.click(screen.getByRole('button', { name: '블록으로 만들기' }));
    expect(await screen.findByTestId('ai-draft-source')).toHaveTextContent(
      'AI 서버에 연결하지 못해 기본 규칙으로 만들었어요',
    );
    expect(onApplyDraft).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '캔버스에 넣기' }));
    const draft = onApplyDraft.mock.calls[0][0] as AiProgramDraft;
    expect(draft).toMatchObject({ source: 'local', fallback: 'unavailable' });
  });

  it('remote 모드에서 힌트 Server 가 503 이면 로컬 힌트와 출처를 보여준다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    server.use(http.post('*/api/v1/ai/hints', () => new HttpResponse(null, { status: 503 })));
    const user = userEvent.setup();
    renderAssistant({
      hintRequest: {
        programLines: ['앞으로 3m 이동'],
        violationCode: 'exceeds-safe-zone',
        violationBlockNumber: 3,
      },
    });
    await user.click(screen.getByRole('button', { name: 'AI 도우미' }));
    await waitFor(() => expect(screen.getByText(/3번째 블록/)).toBeInTheDocument());
    expect(screen.getByTestId('ai-hint-source')).toHaveTextContent('AI 서버에 연결하지 못해');
  });
});

describe('aiSourceLabel', () => {
  it('출처·대체 이유별 문구', () => {
    expect(aiSourceLabel('remote')).toBe('AI 모델이 만들었어요');
    expect(aiSourceLabel('local')).toBe('기본 규칙으로 만들었어요');
    expect(aiSourceLabel('local', 'unavailable')).toContain('연결하지 못해');
    expect(aiSourceLabel('local', 'invalid-response')).toContain('규칙에 맞지 않아');
    expect(aiSourceLabel('local', 'rejected')).toContain('받지 않아서');
  });
});
