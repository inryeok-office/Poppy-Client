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
};

export type ExecutionSseEventDto = Omit<
  ExecutionStatusResponseDto,
  'sessionId' | 'blockVersion' | 'queuedAt'
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
  elapsedSec: number | null;
  message: string | null;
};
