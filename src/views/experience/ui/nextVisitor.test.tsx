import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ExecutionStatus } from '@/features/execution';
import { readSelectedMissionId, writeSelectedMissionId } from '@/features/mission';
import { readLocalDraft, writeLocalDraft } from '@/features/session';
import { readSessionCredentials, writeSessionCredentials } from '@/shared/api';
import { IntroView } from '@/views/intro/ui/IntroView';

import { BlockDragProvider } from '../lib/useBlockDrag';
import { INITIAL_PROGRAM } from '../model/blockProgram';
import { ExperienceView } from './ExperienceView';
import { RunReadyWorkspace } from './RunReadyWorkspace';
import { rectFor } from './dragTestKit';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  push.mockReset();
  vi.restoreAllMocks();
});

function seedPreviousVisitor() {
  writeLocalDraft({
    sessionId: 'prev',
    program: { chain: [], detached: [] },
    blocks: {
      stack: [
        { id: 'start-0', kind: 'start' },
        { id: 'w', kind: 'wait', seconds: 3 },
        { id: 'end-0', kind: 'end' },
      ],
      floating: [],
    },
    projectVersion: 2,
    dirty: false,
  });
  localStorage.setItem('poppy.experience.sessionId', 'prev');
  writeSessionCredentials({
    sessionId: 'prev',
    sessionToken: 't',
    recoveryCode: 'R',
    currentBlockVersion: 2,
  });
  writeSelectedMissionId('f3f450e4-8faf-4d2e-b2aa-6f76ac115412');
}

const canvas = () => screen.getByRole('region', { name: '블록 조립 캔버스' });

const wiped = () =>
  readLocalDraft() === null &&
  readSessionCredentials() === null &&
  localStorage.getItem('poppy.experience.sessionId') === null &&
  readSelectedMissionId() === null;

function withQuery(ui: React.ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('다음 체험자 시작', () => {
  const renderRun = (status: ExecutionStatus | null, onNextVisitor = vi.fn()) => {
    render(
      <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
        <RunReadyWorkspace
          program={INITIAL_PROGRAM}
          executionStatus={status}
          onNextVisitor={onNextVisitor}
        />
      </BlockDragProvider>,
    );
    return onNextVisitor;
  };

  it.each(['completed', 'failed', 'cancelled'] as const)(
    '%s 결과 화면에 버튼이 보이고 누르면 호출된다',
    (status) => {
      const onNext = renderRun(status);
      fireEvent.click(screen.getByRole('button', { name: '다음 체험자 시작' }));
      expect(onNext).toHaveBeenCalledTimes(1);
    },
  );

  it.each([null, 'queued', 'running'] as const)('%s 에는 보이지 않는다', (status) => {
    renderRun(status);
    expect(screen.queryByRole('button', { name: '다음 체험자 시작' })).not.toBeInTheDocument();
  });
});

describe('공용 PC 기록 초기화', () => {
  it('처음으로는 초안·세션·미션 선택을 모두 지우고 첫 화면으로 간다', () => {
    seedPreviousVisitor();
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rectFor);
    withQuery(<ExperienceView />);
    // 방금까지의 같은 체험(새로고침)이라 이전 블록이 복원돼 있다
    expect(within(canvas()).getByText('초 기다리기')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));

    expect(wiped()).toBe(true);
    expect(push).toHaveBeenCalledWith('/');
  });

  it('15분 넘게 지난 기록은 체험 화면에 들어올 때 버리고 빈 캔버스로 시작한다', () => {
    seedPreviousVisitor();
    localStorage.setItem('poppy.experience.lastActivityAt', String(Date.now() - 16 * 60 * 1000));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rectFor);
    withQuery(<ExperienceView />);

    expect(within(canvas()).queryByText('초 기다리기')).not.toBeInTheDocument();
    expect(readSessionCredentials()?.sessionId).not.toBe('prev');
  });

  it.each(['체험하러 가기', '미션 골라서 도전하기'])(
    '인트로 "%s"는 새 체험으로 시작한다',
    (name) => {
      seedPreviousVisitor();
      withQuery(<IntroView />);
      fireEvent.click(screen.getByRole('link', { name: new RegExp(name) }));
      expect(wiped()).toBe(true);
    },
  );
});
