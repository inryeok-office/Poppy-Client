export { useSession, useAutoSaveProject, useRestoreSession } from './api/hooks';
export { createSession, restoreSession, saveProject } from './api/sessionApi';
export { sessionHandlers, __resetSessionMocks } from './api/mocks';
export {
  readLocalDraft,
  writeLocalDraft,
  clearLocalDraft,
  readCachedSessionId,
} from './lib/localDraft';
export type {
  AutoSaveStatus,
  LocalDraft,
  SaveProjectResult,
  SessionInfo,
  SessionRecoveryResult,
} from './model/types';
