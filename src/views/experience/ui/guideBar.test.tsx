import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeSelectedMissionId } from '@/features/mission';
import { readExperienceFlag, writeExperienceFlag } from '@/features/session';

import { guideStep, hintSteps } from '../model/guide';
import { ExperienceView } from './ExperienceView';
import { FAR_X, drag, rectFor } from './dragTestKit';
import { GuideBar } from './GuideBar';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  push.mockReset();
  vi.restoreAllMocks();
});

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rectFor);
  return render(
    <QueryClientProvider client={queryClient}>
      <ExperienceView />
    </QueryClientProvider>,
  );
}

const step = () => screen.getByTestId('guide-step');

describe('guideStep — 상태로 자동 진행', () => {
  it('블록 0개 → 1, 1개 → 2, 값 변경 또는 2개 → 3, 시뮬레이션 통과 → 4', () => {
    expect(guideStep({ blockCount: 0, valueEdited: false, simulationPassed: false })).toBe(1);
    expect(guideStep({ blockCount: 1, valueEdited: false, simulationPassed: false })).toBe(2);
    expect(guideStep({ blockCount: 1, valueEdited: true, simulationPassed: false })).toBe(3);
    expect(guideStep({ blockCount: 2, valueEdited: false, simulationPassed: false })).toBe(3);
    expect(guideStep({ blockCount: 0, valueEdited: false, simulationPassed: true })).toBe(4);
  });

  it('미션 권장 구성을 힌트 블록으로 — 시작·종료 제외, 숫자는 ?', () => {
    expect(hintSteps('시작 → 반복 4회 { 앞으로 이동 → 회전 } → 정지 → 종료')).toEqual([
      '반복 ?회 { 앞으로 이동',
      '회전 }',
      '정지',
    ]);
  });
});

describe('안내 띠 (편집기)', () => {
  it('처음엔 1/4, 블록을 붙이면 2/4, 값을 바꾸면 3/4', () => {
    renderView();
    expect(step()).toHaveTextContent('1/4');
    expect(screen.getByText('왼쪽에서 블록을 끌어 ‘시작’ 아래에 붙여 보세요')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '흐름' }));
    fireEvent.keyDown(screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' }), {
      key: 'Enter',
    });
    expect(step()).toHaveTextContent('2/4');

    const seconds = screen.getByRole('spinbutton', { name: '기다리는 시간 (초)' });
    fireEvent.change(seconds, { target: { value: '2' } });
    fireEvent.blur(seconds);
    expect(step()).toHaveTextContent('3/4');
  });

  it('구조 오류가 있으면 단계 안내 대신 오류 문구가 먼저다', () => {
    renderView();
    drag(screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' }), FAR_X, 600);
    expect(screen.queryByTestId('guide-step')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('연결되지 않은 블록이 있어요');
  });

  it('안내 숨기기는 이번 체험 동안 유지되고, 처음으로를 누르면 초기화된다', () => {
    const view = renderView();
    fireEvent.click(screen.getByRole('button', { name: '안내 숨기기' }));
    expect(screen.queryByTestId('guide-step')).not.toBeInTheDocument();
    expect(readExperienceFlag('guideCollapsed')).toBe(true);

    view.unmount();
    renderView(); // 새로고침
    expect(screen.getByRole('button', { name: '안내 보기' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '처음으로' }));
    expect(readExperienceFlag('guideCollapsed')).toBe(false);
  });

  it('안내 띠는 aria-live=polite', () => {
    renderView();
    expect(step().closest('[aria-live]')).toHaveAttribute('aria-live', 'polite');
  });
});

describe('첫 진입 끌어오기 손가락', () => {
  it('첫 진입에 한 번 보이고, 블록을 끌기 시작하면 사라지며 다시 나오지 않는다', () => {
    const view = renderView();
    const hint = screen.getByTestId('drag-hint');
    expect(hint).toHaveAttribute('aria-hidden', 'true');

    drag(screen.getByRole('button', { name: '초 기다리기 블록 꺼내기' }), FAR_X, 600);
    expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument();
    expect(readExperienceFlag('dragHintShown')).toBe(true);

    view.unmount();
    renderView();
    expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument();
  });

  it('애니메이션이 끝나면 사라진다', () => {
    renderView();
    // jsdom 에는 AnimationEvent 가 없어 React 가 접두사 이벤트를 들을 수 있다 — 둘 다 보낸다.
    const hint = screen.getByTestId('drag-hint');
    fireEvent.animationEnd(hint);
    if (screen.queryByTestId('drag-hint')) {
      fireEvent(hint, new Event('webkitAnimationEnd', { bubbles: true }));
    }
    expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument();
  });

  it('움직임 줄이기 설정이면 보이지 않는다', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) => ({ matches: query.includes('reduce'), media: query }) as MediaQueryList,
    );
    renderView();
    expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument();
  });

  it('이미 보여준 체험에서는 보이지 않는다', () => {
    writeExperienceFlag('dragHintShown', true);
    renderView();
    expect(screen.queryByTestId('drag-hint')).not.toBeInTheDocument();
  });
});

describe('미션 모드 — 목표 + 힌트 보기', () => {
  it('목표를 보여주고, 힌트는 처음 2개만, 더 보기로 전체', async () => {
    writeSelectedMissionId('fca33818-b066-44de-be7d-8afd113e47a9'); // 사각 순찰대
    renderView();

    expect(await screen.findByText('목표')).toBeInTheDocument();
    expect(screen.queryByTestId('guide-step')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '힌트 보기' }));

    const hints = screen.getByRole('group', { name: '미션 힌트' });
    expect(within(hints).getAllByRole('listitem')).toHaveLength(2);
    expect(within(hints).getByText(/반복 \?회/)).toBeInTheDocument();
    fireEvent.click(within(hints).getByRole('button', { name: /더 보기/ }));
    expect(within(hints).getAllByRole('listitem')).toHaveLength(3);
  });

  it('GuideBar 단독: 권장 구성이 없으면 힌트 버튼이 없다', () => {
    render(
      <GuideBar step={1} collapsed={false} onToggle={() => {}} mission={{ goal: '목표 문구' }} />,
    );
    expect(screen.getByText('목표 문구')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '힌트 보기' })).not.toBeInTheDocument();
  });
});

describe('미션 권장 구성 — 무대 중앙에서 포즈', () => {
  it('힌트는 시작·종료를 뺀 6단계', async () => {
    const { RECOMMENDED_COMPOSITION } = await import('@/features/mission');
    expect(hintSteps(RECOMMENDED_COMPOSITION['dc7e71a5-236c-4f6e-8ce0-5ad3e2fe2300'])).toHaveLength(
      6,
    );
  });
});
