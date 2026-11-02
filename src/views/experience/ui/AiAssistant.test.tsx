import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AiProgramDraft } from '@/features/ai';

import { AiAssistant } from './AiAssistant';

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
});
