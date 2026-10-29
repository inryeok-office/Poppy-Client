import { render, screen, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { getExecutionState } from '@/features/execution';
import { createSession } from '@/features/session';
import { server } from '@/shared/api/msw/server';

import { BlockDragProvider } from '../lib/useBlockDrag';
import { INITIAL_PROGRAM } from '../model/blockProgram';
import { MissionResultCard, missionReasonText } from './MissionResultCard';
import { RunReadyWorkspace } from './RunReadyWorkspace';

const FAILED = {
  missionId: 'f3f450e4-8faf-4d2e-b2aa-6f76ac115412',
  passed: false,
  reasons: [
    { code: 'MISSING_REQUIRED_BLOCK', detail: 'TURN_LEFT|TURN_RIGHT' },
    { code: 'LAST_ACTION_MISMATCH', detail: 'STOP' },
  ],
};

describe('missionReasonText', () => {
  it.each([
    [{ code: 'MISSING_REQUIRED_BLOCK', detail: 'REPEAT' }, '‘반복’ 블록이 필요해요.'],
    [
      { code: 'FORBIDDEN_BLOCK', detail: 'MOVE_FORWARD' },
      '이 미션에서는 ‘앞으로 이동’ 블록을 쓰지 않아요.',
    ],
    [
      { code: 'ORDER_NOT_SATISFIED', detail: 'MOVE_FORWARD -> STOP -> PRESET' },
      '순서를 확인해요: 앞으로 이동 → 정지 → 특수 동작',
    ],
    [
      { code: 'TOO_FEW_EXECUTIONS', detail: 'TURN_LEFT|TURN_RIGHT x4' },
      '‘왼쪽 회전 또는 오른쪽 회전’을(를) 4번 이상 해야 해요.',
    ],
    [{ code: 'LAST_ACTION_MISMATCH', detail: 'STOP' }, '마지막은 ‘정지’ 블록으로 끝내요.'],
    [{ code: 'TOO_MANY_BLOCKS', detail: '12 > 10' }, '블록 수를 조금 줄여 봐요.'],
    [{ code: 'SOMETHING_NEW', detail: 'x' }, '미션 조건을 다시 확인해 봐요.'],
  ])('%o → %s', (reason, text) => {
    expect(missionReasonText(reason)).toBe(text);
  });
});

describe('MissionResultCard', () => {
  it('성공이면 성공 문구만 보인다', () => {
    render(<MissionResultCard result={{ ...FAILED, passed: true, reasons: [] }} />);
    expect(screen.getByTestId('mission-result')).toHaveAttribute('data-passed', 'true');
    expect(screen.getByText(/미션 성공/)).toBeInTheDocument();
  });

  it('실패면 사유를 목록으로 보여준다', () => {
    render(<MissionResultCard result={FAILED} />);
    const items = within(screen.getByTestId('mission-result')).getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      '‘왼쪽 회전 또는 오른쪽 회전’ 블록이 필요해요.',
      '마지막은 ‘정지’ 블록으로 끝내요.',
    ]);
  });

  it('RunReadyWorkspace 는 완료 상태에서만 카드를 보여준다', () => {
    const view = render(
      <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
        <RunReadyWorkspace
          program={INITIAL_PROGRAM}
          executionStatus="running"
          missionResult={FAILED}
        />
      </BlockDragProvider>,
    );
    expect(screen.queryByTestId('mission-result')).not.toBeInTheDocument();
    view.rerender(
      <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
        <RunReadyWorkspace
          program={INITIAL_PROGRAM}
          executionStatus="completed"
          missionResult={FAILED}
        />
      </BlockDragProvider>,
    );
    expect(screen.getByTestId('mission-result')).toBeInTheDocument();
  });
});

describe('getExecutionState — missionResult', () => {
  const dto = {
    executionId: 'exec-1',
    sessionId: 'session-1',
    blockVersion: 1,
    status: 'COMPLETED',
    queuePosition: null,
    assignedRobotId: null,
    queuedAt: null,
    startedAt: null,
    finishedAt: null,
  };

  it('Server 가 준 missionResult 를 그대로 옮긴다', async () => {
    server.use(
      http.get('*/api/v1/executions/:id', () =>
        HttpResponse.json({ success: true, data: { ...dto, missionResult: FAILED }, error: null }),
      ),
    );
    const session = await createSession();
    expect((await getExecutionState(session.sessionId, 'exec-1')).missionResult).toEqual(FAILED);
  });

  it('필드가 없는 Server 면 null', async () => {
    server.use(
      http.get('*/api/v1/executions/:id', () =>
        HttpResponse.json({ success: true, data: dto, error: null }),
      ),
    );
    const session = await createSession();
    expect((await getExecutionState(session.sessionId, 'exec-1')).missionResult).toBeNull();
  });
});
