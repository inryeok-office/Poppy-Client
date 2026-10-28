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

/**
 * 자동 저장 상태.
 *   invalid  — 연결 안 된 블록 등 구조 오류라 서버에 보내지 않았다(브라우저에만 보관)
 *   offline  — 네트워크 실패·서버 5xx (브라우저에 보관, 다음 편집 때 다시 시도)
 *   rejected — 서버가 4xx 로 거부 (짧은 한국어 사유를 함께 보여준다)
 *   conflict — 다른 곳에서 먼저 저장됨(409)
 */
export type AutoSaveStatus =
  'idle' | 'saving' | 'saved' | 'invalid' | 'offline' | 'rejected' | 'conflict';
