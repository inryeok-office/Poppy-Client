export type ServerExecutionStatus =
  'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type ExecutionStatus = Lowercase<ServerExecutionStatus>;

export const TERMINAL_STATUSES: ExecutionStatus[] = ['completed', 'failed', 'cancelled'];

export function mapExecutionStatus(status: ServerExecutionStatus): ExecutionStatus {
  return status.toLowerCase() as ExecutionStatus;
}

export function isTerminalStatus(status: ExecutionStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STATUSES.includes(status);
}

export const CANCELLABLE_STATUSES: ExecutionStatus[] = ['queued', 'assigned'];

export function isCancellableStatus(status: ExecutionStatus | undefined): boolean {
  return status !== undefined && CANCELLABLE_STATUSES.includes(status);
}

export type RequestExecutionRequest = {
  sessionId: string;
  blockVersion: number;
};

export type RequestExecutionResult = {
  executionId: string;
  sessionId: string;
  blockVersion: number;
  status: ExecutionStatus;
  queuedAt: string;
};

/** 미션 실행이 COMPLETED 일 때만 Server 가 채우는 블록 구성 기준 판정 (Server #126). */
export type MissionResultCode =
  | 'MISSING_REQUIRED_BLOCK'
  | 'FORBIDDEN_BLOCK'
  | 'ORDER_NOT_SATISFIED'
  | 'TOO_FEW_EXECUTIONS'
  | 'LAST_ACTION_MISMATCH'
  | 'TOO_MANY_BLOCKS';

export type MissionResult = {
  missionId: string;
  passed: boolean;
  reasons: { code: MissionResultCode | string; detail: string }[];
};

export type ExecutionStatusResponseDto = {
  executionId: string;
  sessionId: string | null;
  blockVersion: number | null;
  status: ServerExecutionStatus;
  queuePosition: number | null;
  assignedRobotId: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** 이 필드가 없는 Server 도 있다(미배포). */
  missionResult?: MissionResult | null;
};

export type ExecutionSseEventDto = Omit<
  ExecutionStatusResponseDto,
  'sessionId' | 'blockVersion' | 'queuedAt' | 'missionResult'
> & {
  queuePosition: number | null;
};

/** UI view model; transport values are mapped at the API boundary. */
export type ExecutionState = {
  executionId: string;
  status: ExecutionStatus;
  sessionId?: string | null;
  blockVersion?: number | null;
  queuePosition?: number | null;
  assignedRobotId?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  finishedAt?: string | null;
  missionCleared: boolean | null;
  missionResult: MissionResult | null;
  elapsedSec: number | null;
  message: string | null;
};
