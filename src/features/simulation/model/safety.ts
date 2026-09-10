import type { SerializedBlockProgram } from './types';

// 서버 측 안전 정책 (명세: "서버 정책이 클라이언트보다 우선한다").
// 시뮬레이션 mock 과 실행 mock 이 같은 판정을 쓴다.
export const SAFE_ZONE_M = 2;

const LIMITS = {
  repeatCount: { min: 1, max: 20 },
  moveDistance: { min: 1, max: 10 },
} as const;

const inRange = (raw: unknown, { min, max }: { min: number; max: number }) => {
  const value = Number(raw);
  return Number.isInteger(value) && value >= min && value <= max;
};

export type ProgramEvaluation = {
  structurallyValid: boolean;
  valuesValid: boolean;
  totalDistanceM: number;
  withinSafeZone: boolean;
  /** 시뮬레이션·실제 실행을 모두 진행할 수 있는 상태인지 */
  runnable: boolean;
};

export function evaluateProgram(program: SerializedBlockProgram): ProgramEvaluation {
  const valuesValid =
    inRange(program.repeatCount, LIMITS.repeatCount) &&
    inRange(program.moveDistance, LIMITS.moveDistance);
  const totalDistanceM = valuesValid ? program.repeatCount * program.moveDistance : 0;
  const structurallyValid = program.detached.length === 0 && program.chain.at(-1) === 'end';
  const withinSafeZone = valuesValid && totalDistanceM <= SAFE_ZONE_M;

  return {
    structurallyValid,
    valuesValid,
    totalDistanceM,
    withinSafeZone,
    runnable: structurallyValid && valuesValid && withinSafeZone,
  };
}
