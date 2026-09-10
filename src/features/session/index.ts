export { useSession, useAutoSaveProject } from './api/hooks';
export { createSession, saveProject } from './api/sessionApi';
export { sessionHandlers, __resetSessionMocks } from './api/mocks';
export {
  readLocalDraft,
  writeLocalDraft,
  clearLocalDraft,
  readCachedSessionId,
} from './lib/localDraft';
export type { AutoSaveStatus, LocalDraft, SessionInfo } from './model/types';
