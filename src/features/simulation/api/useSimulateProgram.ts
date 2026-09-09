import { useMutation } from '@tanstack/react-query';

import { simulateProgram } from './simulateProgram';

/**
 * 시뮬레이션 실행 mutation.
 * `isPending` = 검증 중, `data.passed` = 통과 여부, `reset()` = 통과 기록 무효화.
 */
export function useSimulateProgram() {
  return useMutation({ mutationFn: simulateProgram });
}
