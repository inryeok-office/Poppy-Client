import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { mockRouter } from '@/shared/testing/routerMock';

import { writeSimulationResult } from '../lib/simulationResultStorage';
import { INITIAL_PROGRAM, type BlockProgram } from '../model/blockProgram';
import { SimulationResultView } from './SimulationResultView';

// INITIAL_PROGRAM(시작 → 반복(2){뒤로 1m} → 인사하기) + 종료 연결.
// 실행순서로 펼치면: 시작, 뒤로1m, 뒤로1m, 인사하기, 종료 (5단계).
const CONNECTED_PROGRAM: BlockProgram = {
  stack: [...INITIAL_PROGRAM.stack, { id: 'end-0', kind: 'end' }],
  floating: [],
};

describe('SimulationResultView', () => {
  it('남겨진 결과가 없으면 /experience 로 돌려보낸다', () => {
    render(<SimulationResultView />);

    expect(mockRouter.replace).toHaveBeenCalledWith('/experience');
  });

  it('실패 결과 — 실패 배지·안내·실행순서 상태·잠긴 실행 버튼을 보여준다', async () => {
    const user = userEvent.setup();
    writeSimulationResult({
      program: CONNECTED_PROGRAM,
      result: {
        passed: false,
        normalizedCommandCount: 5,
        totalDistanceM: 2,
        violations: [{ code: 'exceeds-safe-zone', message: '로봇이 2m 안전 구역을 벗어나요.' }],
        failedAtIndex: 3, // 두 번째 '뒤로 1m 이동'(세 번째 단계)에서 멈춤
        notes: [],
      },
    });

    render(<SimulationResultView />);

    expect(screen.getByText('실패')).toBeInTheDocument();
    expect(screen.getByText('조금만 고치면 돼요!')).toBeInTheDocument();
    expect(screen.getByText('로봇이 2m 안전 구역을 벗어나요.')).toBeInTheDocument();
    expect(screen.getByText('3번째 블록에서 멈춤')).toBeInTheDocument();

    const lockedRun = screen.getByRole('button', { name: /로봇 실행하기/ });
    expect(lockedRun).toHaveTextContent('잠김');
    expect(lockedRun).toHaveAttribute('aria-disabled');

    // 실행순서: 1·2단계 완료, 3단계 문제 발생, 4·5단계 대기
    const steps = within(screen.getByRole('list', { name: '실행순서' })).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    expect(within(steps[0]).getByText('완료')).toBeInTheDocument();
    expect(within(steps[1]).getByText('완료')).toBeInTheDocument();
    expect(within(steps[2]).getByText('문제 발생')).toBeInTheDocument();
    expect(within(steps[3]).getByText('대기')).toBeInTheDocument();
    expect(within(steps[4]).getByText('대기')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '블록 고치기' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/experience');
  });

  it('성공 결과 — 성공 배지·안내·모든 단계 완료·활성화된 실행 버튼을 보여준다', async () => {
    const user = userEvent.setup();
    writeSimulationResult({
      program: CONNECTED_PROGRAM,
      result: {
        passed: true,
        normalizedCommandCount: 5,
        totalDistanceM: 2,
        violations: [],
        notes: [],
      },
    });

    render(<SimulationResultView />);

    expect(screen.getByText('성공')).toBeInTheDocument();
    expect(screen.getByText('시뮬레이션 통과!')).toBeInTheDocument();
    expect(
      screen.getByText('안전 범위 안에서 잘 움직였어요. 이제 실제 로봇으로 실행할 수 있어요.'),
    ).toBeInTheDocument();
    expect(screen.getByText('5/5 단계 성공')).toBeInTheDocument();

    const steps = within(screen.getByRole('list', { name: '실행순서' })).getAllByRole('listitem');
    expect(steps).toHaveLength(5);
    for (const step of steps) {
      expect(within(step).getByText('완료')).toBeInTheDocument();
    }

    const runButton = screen.getByRole('button', { name: '로봇 실행하기' });
    expect(runButton).not.toHaveAttribute('aria-disabled');
    await user.click(runButton);
    expect(mockRouter.push).toHaveBeenCalledWith('/experience');
  });
});
