'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  cancelExecution as cancelExecutionApi,
  isTerminalStatus,
  useCancelExecution,
  useExecutionState,
  useRequestExecution,
} from '@/features/execution';
import { readLocalDraft, useAutoSaveProject, useSession } from '@/features/session';
import { useSimulateProgram } from '@/features/simulation';

import { BlockDragProvider } from '../lib/useBlockDrag';
import { blockLabel } from '../model/blockCatalog';
import {
  INITIAL_PROGRAM,
  blockCommandCount,
  connectDetachedBlocks,
  draftToProgram,
  dropOnSlot,
  isBlockProgramSnapshot,
  newBlock,
  serializeProgram,
  setBlockParam,
  validateBlockProgram,
  type BlockKind,
  type BlockProgram,
} from '../model/blockProgram';
import type { BlockParamPatch } from './BlockStack';
import { BlockPalette } from './BlockPalette';
import { BlockWorkspace } from './BlockWorkspace';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';
import { RunReadyWorkspace } from './RunReadyWorkspace';

/**
 * 블록 코딩 체험 화면 (Figma "뽀삐" node 21:520 / Slide 2·3·4).
 *
 * 명세(Mission & Block · Simulation · Execution) 기준 상태 흐름:
 *   1. 블록 구조 검증 — 오류가 있으면 '시뮬레이션 하기' 비활성 (떨어진 '종료' 연결 필요)
 *   2. 구조·값·안전 제한(이동 거리)을 모두 통과해야 시뮬레이션 통과 기록 발급
 *   3. 통과 기록이 있어야 '로봇 실행하기' 활성 — 없으면 잠김
 *   4. '로봇 실행하기' → 실행 요청 → 대기·배정·진행·완료 상태를 안내문에 표시 (실행 중지 가능)
 * 블록 값을 바꾸거나 '전체 지우기'/'처음으로' 를 누르면 통과 기록·실행을 무효화한다
 * (명세: "블록·모드·미션·안전 정책 변경 시 기록을 무효화"). 진행 중인 실행은 서버에도 취소를 보낸다.
 *
 * 시뮬레이션·실행은 features/{simulation,execution} 의 mock API(MSW). 실제 백엔드가 생기면 핸들러만 걷어낸다.
 */
/** 마운트 시 브라우저 초안이 있으면 그 프로그램으로 시작한다 (명세: 새로고침해도 작업 보존). */
function initialProgram(): { program: BlockProgram; restoredDirty: boolean } {
  const draft = readLocalDraft();
  if (draft && isBlockProgramSnapshot(draft.blocks)) {
    return { program: draftToProgram(draft.blocks), restoredDirty: draft.dirty };
  }
  return { program: INITIAL_PROGRAM, restoredDirty: false };
}

const AUTOSAVE_DEBOUNCE_MS = 600;

export function ExperienceView() {
  const [{ program: startProgram, restoredDirty }] = useState(initialProgram);
  const [program, setProgram] = useState<BlockProgram>(startProgram);
  const [executionId, setExecutionId] = useState<string | null>(null);
  // 드래그·키보드 편집 결과를 스크린리더에 알린다 (캔버스 변화는 시각 전용이라).
  const [announcement, setAnnouncement] = useState('');
  // 초기화 후 늦게 도착한 실행 요청 onSuccess 가 오래된 실행 ID 를 되살리지 않게 한다.
  const runGeneration = useRef(0);

  const session = useSession();
  const autoSave = useAutoSaveProject(session.data?.sessionId ?? null);
  const simulation = useSimulateProgram();
  const requestExecution = useRequestExecution();
  const cancelExecution = useCancelExecution();
  const execution = useExecutionState(executionId);

  const blockErrors = useMemo(() => validateBlockProgram(program), [program]);
  const blockValid = blockErrors.length === 0;

  // ── 자동 저장 (명세 Session "프로젝트 자동 저장") ─────────────────────────────
  const { save: saveProgram, setBaseVersion } = autoSave;
  const savedProgramRef = useRef<BlockProgram>(program);

  // 세션 확보 시 서버 버전을 맞추고, 세션 준비 전 변경분·미저장 초안을 동기화한다.
  useEffect(() => {
    if (!session.data) return;
    setBaseVersion(session.data.projectVersion);
    if (restoredDirty || program !== startProgram) saveProgram(serializeProgram(program), program);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.data, setBaseVersion]);

  // program 이 실제로 바뀌면 디바운스 후 저장한다.
  useEffect(() => {
    if (program === savedProgramRef.current) return;
    const timer = window.setTimeout(() => {
      savedProgramRef.current = program;
      saveProgram(serializeProgram(program), program);
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [program, saveProgram]);
  // ────────────────────────────────────────────────────────────────────────

  const simulationResult = simulation.data;
  const simulationPassed = simulationResult?.passed === true;
  const simulationMessage = simulation.isError
    ? '시뮬레이션에 실패했어요. 잠시 후 다시 시도해 주세요.'
    : simulationResult && !simulationResult.passed
      ? simulationResult.violations[0]?.message
      : undefined;
  const estimatedDistanceM = simulationResult?.totalDistanceM ?? 0;

  const executionStatus = executionId !== null ? (execution.data?.status ?? 'queued') : null;
  const executionSettled = isTerminalStatus(executionStatus ?? undefined);
  const executionMessage = execution.data?.message ?? null;

  const clearExecution = () => {
    // 진행 중인 실행이면 서버에도 취소를 보낸다.
    if (executionId !== null && !executionSettled) {
      void cancelExecutionApi(executionId).catch(() => {});
    }
    runGeneration.current += 1;
    setExecutionId(null);
    requestExecution.reset();
    cancelExecution.reset();
  };

  const invalidate = () => {
    simulation.reset();
    clearExecution();
  };

  const runSimulation = () => {
    if (simulation.isPending || !blockValid) return;
    simulation.mutate({ program: serializeProgram(program) });
  };

  const requestRun = () => {
    if (!simulationPassed || requestExecution.isPending) return;
    // 진행 중인 실행이 있으면 무시, 끝난 실행이면 새로 요청한다.
    if (executionId !== null && !executionSettled) return;

    setExecutionId(null);
    requestExecution.reset();
    const generation = (runGeneration.current += 1);
    requestExecution.mutate(
      { program: serializeProgram(program) },
      {
        onSuccess: (data) => {
          if (generation === runGeneration.current) setExecutionId(data.executionId);
          else void cancelExecutionApi(data.executionId).catch(() => {});
        },
      },
    );
  };

  const stopRun = () => {
    if (executionId === null) return;
    cancelExecution.mutate(executionId, { onSuccess: () => void execution.refetch() });
  };

  const changeBlockParam = (id: string, patch: BlockParamPatch) => {
    setProgram((current) => setBlockParam(current, id, patch));
    invalidate();
  };

  // 드래그 드롭 결과 프로그램 (스냅 연결 / 놓은 자리에 두기 — blockProgram.ts).
  const applyDrop = (next: BlockProgram, kind: 'connect' | 'place') => {
    setProgram(next);
    invalidate();
    setAnnouncement(kind === 'connect' ? '블록을 연결했어요.' : '블록을 옮겼어요.');
  };

  // 팔레트에서 키보드(Enter)로 블록을 집으면 스택 끝(종료 앞)에 연결한다.
  const pickBlock = (kind: BlockKind) => {
    setProgram((current) => {
      const end = current.stack.at(-1)?.kind === 'end';
      const slot = end ? current.stack.length - 1 : current.stack.length;
      return dropOnSlot(current, { origin: 'palette', node: newBlock(kind) }, slot);
    });
    invalidate();
    setAnnouncement(`${blockLabel(kind)} 블록을 추가했어요.`);
  };

  const connectBlock = () => {
    setProgram(connectDetachedBlocks);
    invalidate();
  };

  const resetSession = () => {
    setProgram(INITIAL_PROGRAM);
    invalidate();
  };

  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader
        onClearAll={resetSession}
        onRestart={resetSession}
        saveStatus={autoSave.status}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      <BlockDragProvider program={program} onChange={applyDrop}>
        <div className="flex flex-1">
          <BlockPalette onPickBlock={pickBlock} />
          {simulationPassed ? (
            <RunReadyWorkspace
              program={program}
              requesting={requestExecution.isPending}
              executionStatus={executionStatus}
              executionMessage={executionMessage}
              onSimulate={runSimulation}
              onRun={requestRun}
              onStop={stopRun}
            />
          ) : (
            <BlockWorkspace
              program={program}
              errors={blockErrors}
              onConnectBlock={connectBlock}
              onBlockParamChange={changeBlockParam}
              onSimulate={runSimulation}
              simulating={simulation.isPending}
              simulationMessage={simulationMessage}
            />
          )}
          <RobotPreview
            estimatedDistanceM={estimatedDistanceM}
            blockCount={blockCommandCount(program)}
          />
        </div>
      </BlockDragProvider>
    </div>
  );
}
