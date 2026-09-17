import type { SerializedBlockProgram } from '@/features/simulation';

export type SessionInfo = {
  sessionId: string;
  sessionToken: string;
  recoveryCode: string;
  currentBlockVersion: number;
  /** UI compatibility alias for the immutable Server block version. */
  projectVersion: number;
};

export type SaveProjectRequest = {
  program: SerializedBlockProgram;
  baseVersion: number;
};

export type SaveProjectResult = {
  sessionId: string;
  blockVersion: number;
  /** UI compatibility alias for the immutable Server block version. */
  projectVersion: number;
};

export type SessionRecoveryResult = SessionInfo;

export type LocalDraft = {
  sessionId: string;
  program: SerializedBlockProgram;
  blocks?: unknown;
  projectVersion: number;
  dirty: boolean;
};

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'conflict';
