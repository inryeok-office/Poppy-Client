// 실제 로봇 실행 계약 (기능명세서 Execution).
// 백엔드(Poppy-Server)가 확정되면 실제 응답 형태에 맞춰 조정한다.

import type { SerializedBlockProgram } from '@/features/simulation';

/** 실행 대기열 상태 (명세: "대기·배정·실행·완료·실패·취소"). */
export type ExecutionStatus =
  'queued' | 'assigned' | 'running' | 'completed' | 'failed' | 'cancelled';

export const TERMINAL_STATUSES: ExecutionStatus[] = ['completed', 'failed', 'cancelled'];

export function isTerminalStatus(status: ExecutionStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.includes(status);
}

/** 체험자가 취소할 수 있는 상태 (명세: "체험자는 QUEUED·ASSIGNED에서만 취소할 수 있다.
 *  RUNNING 이후 중지는 관리자 기능으로 처리한다"). */
export const CANCELLABLE_STATUSES: ExecutionStatus[] = ['queued', 'assigned'];

export function isCancellableStatus(status: ExecutionStatus | undefined): boolean {
  return status !== undefined && CANCELLABLE_STATUSES.includes(status);
}

export type RequestExecutionRequest = {
  program: SerializedBlockProgram;
};

export type RequestExecutionResult = {
  executionId: string;
};

export type ExecutionState = {
  executionId: string;
  status: ExecutionStatus;
  /** 미션 성공 여부 (완료 시). 자유 모드는 null. */
  missionCleared: boolean | null;
  /** 실행에 걸린 시간 (초). 완료·실패 시. */
  elapsedSec: number | null;
  /** 실패 사유 등 (명세: "이해 가능한 이유"). */
  message: string | null;
};
