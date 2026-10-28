import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BlockDragProvider } from '../lib/useBlockDrag';
import { INITIAL_PROGRAM } from '../model/blockProgram';
import { QUEUED_TOO_LONG_MS, RunReadyWorkspace } from './RunReadyWorkspace';
import type { ExecutionStatus } from '@/features/execution';

function renderWorkspace(status: ExecutionStatus | null, onStop = vi.fn()) {
  const view = render(
    <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
      <RunReadyWorkspace program={INITIAL_PROGRAM} executionStatus={status} onStop={onStop} />
    </BlockDragProvider>,
  );
  return {
    ...view,
    rerenderStatus: (next: ExecutionStatus | null) =>
      view.rerender(
        <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
          <RunReadyWorkspace program={INITIAL_PROGRAM} executionStatus={next} onStop={onStop} />
        </BlockDragProvider>,
      ),
  };
}

describe('RunReadyWorkspace — QUEUED 15초 초과 안내', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('QUEUED 가 15초를 넘으면 로봇 준비 안내와 강조된 취소 버튼을 보여준다', () => {
    renderWorkspace('queued');
    expect(screen.getByText('실행을 기다리고 있어요…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '실행 중지' })).not.toHaveClass('ring-2');

    act(() => vi.advanceTimersByTime(QUEUED_TOO_LONG_MS - 1));
    expect(screen.queryByText(/로봇이 아직 준비되지 않았어요/)).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByText(/로봇이 아직 준비되지 않았어요/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '실행 취소하기' })).toHaveClass('ring-2');
  });

  it('15초 전에 배정되면 안내가 뜨지 않고, 상태가 바뀌면 다시 센다', () => {
    const view = renderWorkspace('queued');
    act(() => vi.advanceTimersByTime(10_000));
    view.rerenderStatus('assigned');
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByText(/로봇이 아직 준비되지 않았어요/)).not.toBeInTheDocument();
    expect(screen.getByText('로봇에 배정됐어요.')).toBeInTheDocument();
  });
});
