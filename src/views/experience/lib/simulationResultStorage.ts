import type { SimulationResult } from '@/features/simulation';

import type { BlockProgram } from '../model/blockProgram';

// 시뮬레이션 결과 화면(신규 라우트 /experience/simulation)에 넘길 마지막 시뮬레이션 결과.
// ExperienceView 는 컴포넌트가 아니라 페이지 단위로 떠 있어, 라우트를 넘어가면 리액트 state 가
// 사라진다 — 세션 탭 안에서만 유효하면 되는 값이라 sessionStorage 에 program·result 를 함께
// 스냅샷으로 남긴다(program 은 이미 있는 localDraft 대신 직접 들고 다닌다 — 시뮬레이트 시점과
// 결과 화면을 보는 시점 사이에 사용자가 블록을 더 편집했을 수 있어, 그 프로그램과 결과가
// 어긋나면 안 된다).
const KEY = 'poppy.experience.simulationResult';

export type StoredSimulationResult = {
  program: BlockProgram;
  result: SimulationResult;
};

function safeSessionStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function writeSimulationResult(value: StoredSimulationResult): void {
  try {
    safeSessionStorage()?.setItem(KEY, JSON.stringify(value));
  } catch {
    // 저장 공간 초과 등 — 무시. 결과 화면이 읽을 게 없으면 /experience 로 돌려보낸다.
  }
}

export function readSimulationResult(): StoredSimulationResult | null {
  const store = safeSessionStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    return raw ? (JSON.parse(raw) as StoredSimulationResult) : null;
  } catch {
    return null;
  }
}

export function clearSimulationResult(): void {
  try {
    safeSessionStorage()?.removeItem(KEY);
  } catch {
    // 무시
  }
}

/** 저장된 결과가 지금 이 program 을 대상으로 한 게 맞는지 (그 사이 편집됐으면 무효). */
export function isResultForProgram(
  stored: StoredSimulationResult | null,
  program: BlockProgram,
): stored is StoredSimulationResult {
  return stored != null && JSON.stringify(stored.program) === JSON.stringify(program);
}
