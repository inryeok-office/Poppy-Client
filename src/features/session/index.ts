export {
  useAutoSaveProject,
  useRestoreSession,
  useSession,
  useStartNewExperience,
} from './api/hooks';
export {
  EXPERIENCE_IDLE_TIMEOUT_MS,
  expireIdleExperience,
  resetExperienceStorage,
} from './lib/experienceLifecycle';
export { InvalidProgramError, createSession, restoreSession, saveProject } from './api/sessionApi';
export { sessionHandlers, __resetSessionMocks } from './api/mocks';
export {
  readLocalDraft,
  writeLocalDraft,
  clearLocalDraft,
  readCachedSessionId,
  readLastActivityAt,
  touchExperienceActivity,
} from './lib/localDraft';
export type {
  AutoSaveStatus,
  LocalDraft,
  SaveProjectResult,
  SessionInfo,
  SessionRecoveryResult,
} from './model/types';
