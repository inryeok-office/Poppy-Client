import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { SerializedBlockProgram } from '@/features/simulation';
import { ApiError, readSessionCredentials } from '@/shared/api';

import { readCachedSessionId, writeCachedSessionId, writeLocalDraft } from '../lib/localDraft';
import type { AutoSaveStatus, SessionInfo } from '../model/types';
import { createSession, saveProject } from './sessionApi';

async function ensureSession(): Promise<SessionInfo> {
  const cachedId = readCachedSessionId();
  const credentials = readSessionCredentials();
  if (cachedId && credentials?.sessionId === cachedId) {
    return { ...credentials, projectVersion: credentials.currentBlockVersion };
  }

  const created = await createSession();
  writeCachedSessionId(created.sessionId);
  return created;
}

export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: ensureSession, staleTime: Infinity });
}

type QueuedSave = { program: SerializedBlockProgram; snapshot?: unknown };

export function useAutoSaveProject(sessionId: string | null) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [projectVersion, setProjectVersion] = useState(0);
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<QueuedSave | null>(null);
  const drainPromiseRef = useRef<Promise<number> | null>(null);

  const setBaseVersion = useCallback((version: number) => {
    versionRef.current = version;
    setProjectVersion(version);
  }, []);

  const drain = useCallback((): Promise<number> => {
    if (drainPromiseRef.current) return drainPromiseRef.current;

    const run = async (): Promise<number> => {
      if (savingRef.current) return versionRef.current;
      savingRef.current = true;

      let outcome: AutoSaveStatus = 'saved';
      while (queuedRef.current !== null) {
        const { program: target, snapshot } = queuedRef.current;
        queuedRef.current = null;
        setStatus('saving');

        if (!sessionId) {
          writeLocalDraft({
            sessionId: '',
            program: target,
            blocks: snapshot,
            projectVersion: versionRef.current,
            dirty: true,
          });
          outcome = 'offline';
          break;
        }

        try {
          const result = await saveProject(sessionId, {
            program: target,
            baseVersion: versionRef.current,
          });
          versionRef.current = result.blockVersion;
          setProjectVersion(result.blockVersion);
          writeLocalDraft({
            sessionId,
            program: target,
            blocks: snapshot,
            projectVersion: result.blockVersion,
            dirty: false,
          });
          outcome = 'saved';
        } catch (error) {
          writeLocalDraft({
            sessionId,
            program: target,
            blocks: snapshot,
            projectVersion: versionRef.current,
            dirty: true,
          });
          outcome = error instanceof ApiError && error.status === 409 ? 'conflict' : 'offline';
          break;
        }
      }

      setStatus(outcome);
      savingRef.current = false;
      return versionRef.current;
    };

    const promise = run().finally(() => {
      drainPromiseRef.current = null;
    });
    drainPromiseRef.current = promise;
    return promise;
  }, [sessionId]);

  const save = useCallback(
    (program: SerializedBlockProgram, snapshot?: unknown) => {
      queuedRef.current = { program, snapshot };
      void drain();
    },
    [drain],
  );

  return { status, save, flush: drain, setBaseVersion, projectVersion };
}
