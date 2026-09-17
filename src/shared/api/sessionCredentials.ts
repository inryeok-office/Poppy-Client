const STORAGE_KEY = 'poppy.session.credentials';

export type StoredSessionCredentials = {
  sessionId: string;
  sessionToken: string;
  recoveryCode: string;
  currentBlockVersion: number;
};

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readSessionCredentials(): StoredSessionCredentials | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredSessionCredentials>;
    if (
      typeof value.sessionId !== 'string' ||
      typeof value.sessionToken !== 'string' ||
      typeof value.recoveryCode !== 'string' ||
      typeof value.currentBlockVersion !== 'number'
    ) {
      return null;
    }
    return value as StoredSessionCredentials;
  } catch {
    return null;
  }
}

export function writeSessionCredentials(credentials: StoredSessionCredentials): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(credentials));
  } catch {
    // Storage failure must not expose credentials or break the in-memory API flow.
  }
}

export function clearSessionCredentials(): void {
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable browser storage.
  }
}

export function sessionAuthHeaders(sessionId?: string): Record<string, string> {
  const credentials = readSessionCredentials();
  if (!credentials || (sessionId && credentials.sessionId !== sessionId)) {
    throw new Error('An active session credential is required');
  }
  return { 'X-Session-Token': credentials.sessionToken };
}
