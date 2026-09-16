import type { SimulationResult } from '@/features/simulation';

import { isBlockProgramSnapshot, type BlockProgram } from '../model/blockProgram';

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

/**
 * 성공 여부를 반환한다 — 저장이 실패했는데(용량 초과·접근 거부 등) 호출자가 모르고 결과
 * 화면으로 이동하면, 그 화면은 읽을 게 없어 곧장 /experience 로 되돌아가 방금 끝난
 * 시뮬레이션 결과가 통째로 사라진다. 실패하면 호출자가 지금 화면에서 계속 보여줘야 한다.
 */
export function writeSimulationResult(value: StoredSimulationResult): boolean {
  try {
    const store = safeSessionStorage();
    if (!store) return false;
    store.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isSimulationResultShape(value: unknown): value is SimulationResult {
  if (typeof value !== 'object' || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.passed === 'boolean' &&
    typeof r.normalizedCommandCount === 'number' &&
    typeof r.totalDistanceM === 'number' &&
    Array.isArray(r.violations) &&
    Array.isArray(r.notes) &&
    (r.failedAtIndex === undefined || typeof r.failedAtIndex === 'number')
  );
}

/** 저장된 값이 실제로 program·result 모양을 갖췄는지 확인한다 — JSON 파싱만 되고 필드가
 *  빠지거나 어긋난 값을 그대로 믿으면 결과 화면이 program.stack 등에 접근하다 죽는다. */
function isStoredSimulationResult(value: unknown): value is StoredSimulationResult {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return isBlockProgramSnapshot(v.program) && isSimulationResultShape(v.result);
}

export function readSimulationResult(): StoredSimulationResult | null {
  const store = safeSessionStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isStoredSimulationResult(parsed) ? parsed : null;
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
