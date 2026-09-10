// 체험 세션 · 프로젝트 자동 저장 계약 (기능명세서 Session).
// 백엔드(Poppy-Server)가 확정되면 실제 응답 형태에 맞춰 조정한다.

import type { SerializedBlockProgram } from '@/features/simulation';

export type SessionInfo = {
  sessionId: string;
  /** 저장 충돌 감지용 버전 번호 (명세: "버전 번호로 최신 수정 충돌을 감지") */
  projectVersion: number;
};

export type SaveProjectRequest = {
  program: SerializedBlockProgram;
  /** 클라이언트가 아는 마지막 버전. 서버가 이보다 최신이면 409. */
  baseVersion: number;
};

export type SaveProjectResult = {
  projectVersion: number;
};

/** localStorage 임시 보관 초안 (오프라인 폴백) */
export type LocalDraft = {
  sessionId: string;
  program: SerializedBlockProgram;
  /**
   * 충실 복원용 도메인 스냅샷 (블록 트리 등). 자동 저장은 이 값을 해석하지 않고 그대로 보관하고,
   * 복원 시 호출부(views)가 형태를 검증한다.
   */
  blocks?: unknown;
  projectVersion: number;
  /** 서버에 아직 반영되지 않은 변경인지 */
  dirty: boolean;
};

export type AutoSaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'conflict';
