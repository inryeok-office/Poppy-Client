import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readSelectedMissionId, writeSelectedMissionId } from '@/features/mission';
import { readLocalDraft, writeLocalDraft } from '@/features/session';

import { BlockDragProvider } from '@/views/experience/lib/useBlockDrag';
import { INITIAL_PROGRAM, validateBlockProgram } from '@/views/experience/model/blockProgram';
import { kindsForServerTypes } from '@/views/experience/model/missionBlocks';
import { BlockPalette } from '@/views/experience/ui/BlockPalette';
import { ExperienceView } from '@/views/experience/ui/ExperienceView';
import { rectFor } from '@/views/experience/ui/dragTestKit';
import { IntroView } from '@/views/intro/ui/IntroView';

import { MissionDetailView } from './MissionDetailView';
import { MissionListView } from './MissionListView';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const DELIVERY = 'f3f450e4-8faf-4d2e-b2aa-6f76ac115412';
const PATROL = 'fca33818-b066-44de-be7d-8afd113e47a9';

function withQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

afterEach(() => {
  push.mockReset();
  vi.restoreAllMocks();
});

describe('미션 허용 블록', () => {
  it('Server BlockType 을 팔레트 블록 종류로 바꾼다 (PRESET 은 특수 동작 3개)', () => {
    expect([...kindsForServerTypes(['MOVE_FORWARD', 'STOP'])]).toEqual(['moveForward', 'stop']);
    expect([...kindsForServerTypes(['PRESET', 'UNKNOWN'])]).toEqual(['greet', 'heart', 'dance']);
  });

  it('미션이 허용하지 않은 블록이 있으면 검증 오류', () => {
    const program = {
      stack: [
        { id: 's', kind: 'start' as const },
        { id: 'w', kind: 'wait' as const, seconds: 1 },
        { id: 'e', kind: 'end' as const },
      ],
      floating: [],
    };
    const allowed = kindsForServerTypes(['MOVE_FORWARD', 'STOP']);
    expect(validateBlockProgram(program, allowed).map((e) => e.code)).toEqual([
      'not-allowed-in-mission',
    ]);
    expect(validateBlockProgram(program)).toEqual([]);
  });

  it('팔레트는 허용 블록만 보여주고, 허용 블록이 없는 카테고리는 숨긴다', () => {
    render(
      <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
        <BlockPalette allowedKinds={kindsForServerTypes(['MOVE_FORWARD', 'STOP'])} />
      </BlockDragProvider>,
    );
    expect(screen.queryByRole('button', { name: '흐름' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '동작' })).not.toBeInTheDocument();
    const names = screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((n): n is string => n?.endsWith('꺼내기') ?? false);
    expect(names).toEqual(['앞으로 이동 블록 꺼내기', '정지 블록 꺼내기']);
  });
});

describe('미션 목록·상세', () => {
  it('난이도 하·중·상으로 묶어 보여주고 상세로 연결한다', async () => {
    withQuery(<MissionListView />);
    const easy = await screen.findByRole('region', { name: '난이도 하' });
    const link = within(easy).getByRole('link', { name: /로봇 택배 배달/ });
    expect(link).toHaveAttribute('href', `/missions/${DELIVERY}`);
    expect(within(screen.getByRole('region', { name: '난이도 상' })).getByText('사각 순찰대'));
  });

  it('상세는 목표·권장 구성·완료 조건·쓸 수 있는 블록을 보여주고, 시작하면 빈 캔버스로 미션을 연다', async () => {
    writeLocalDraft({
      sessionId: 's',
      program: { chain: [], detached: [] },
      projectVersion: 1,
      dirty: false,
    });
    withQuery(<MissionDetailView missionId={PATROL} />);

    expect(await screen.findByRole('heading', { name: '사각 순찰대' })).toBeInTheDocument();
    expect(screen.getByText(/반복 4회/)).toBeInTheDocument();
    expect(screen.getByText('반복 블록 사용 필수')).toBeInTheDocument();
    expect(
      screen.getByText('반복하기 · 앞으로 이동 · 왼쪽으로 회전 · 오른쪽으로 회전 · 정지'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이 미션 시작하기' }));
    expect(readSelectedMissionId()).toBe(PATROL);
    expect(readLocalDraft()).toBeNull();
    expect(push).toHaveBeenCalledWith('/experience');
  });

  it('없는 미션이면 안내를 보여준다', async () => {
    withQuery(<MissionDetailView missionId="00000000-0000-0000-0000-000000000000" />);
    expect(await screen.findByRole('alert')).toHaveTextContent('미션을 찾지 못했어요');
  });
});

describe('편집기 미션 모드', () => {
  it('고른 미션의 배너와 허용 블록만 보이고, 자유 체험으로 바꾸면 전부 보인다', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rectFor);
    writeSelectedMissionId(DELIVERY);
    withQuery(<ExperienceView />);

    const banner = await screen.findByRole('region', { name: '진행 중인 미션' });
    expect(within(banner).getByText('로봇 택배 배달')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '흐름' })).not.toBeInTheDocument();

    fireEvent.click(within(banner).getByRole('button', { name: '미션 목록' }));
    expect(push).toHaveBeenCalledWith('/missions');

    fireEvent.click(within(banner).getByRole('button', { name: '자유 체험으로' }));
    expect(screen.queryByRole('region', { name: '진행 중인 미션' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '흐름' })).toBeInTheDocument();
    expect(readSelectedMissionId()).toBeNull();
  });
});

describe('시작 화면', () => {
  it('미션 도전은 /missions, 자유 체험은 고른 미션을 지우고 /experience', () => {
    writeSelectedMissionId(DELIVERY);
    withQuery(<IntroView />);
    expect(screen.getByRole('link', { name: '미션 골라서 도전하기' })).toHaveAttribute(
      'href',
      '/missions',
    );
    const free = screen.getByRole('link', { name: /체험하러 가기/ });
    expect(free).toHaveAttribute('href', '/experience');
    fireEvent.click(free);
    expect(readSelectedMissionId()).toBeNull();
  });
});
