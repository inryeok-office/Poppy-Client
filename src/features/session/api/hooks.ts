import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { SerializedBlockProgram } from '@/features/simulation';
import { ApiError, readSessionCredentials } from '@/shared/api';

import {
  clearLocalDraft,
  readCachedSessionId,
  writeCachedSessionId,
  writeLocalDraft,
} from '../lib/localDraft';
import type { AutoSaveStatus, SessionInfo } from '../model/types';
import { createSession, restoreSession, saveProject } from './sessionApi';

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

/**
 * 복구 코드 화면(Figma Slide 8·9, 명세 "세션 복구"). restoreSession 은 새 sessionToken 을
 * 발급할 뿐 로컬 캐시는 안 건드리는데, 그대로 두면 useSession 의 ensureSession 이
 * "캐시된 세션 ID와 다르다"고 보고 곧장 새 세션을 또 만들어 방금 복구한 세션을 덮어써
 * 버린다 — writeCachedSessionId 로 지금 복구한 세션을 "현재 세션"으로 못박는다.
 * 로컬 임시본(poppy.experience.draft)도 지운다 — 세션별로 구분해 저장하지 않아서, 남겨두면
 * 이전 세션의 블록을 복구한 세션 것인 양 이어서 자동 저장해 버린다.
 *
 * 주의: 이건 세션 "정체성"만 복구한다. 그 세션에 저장돼 있던 블록 내용 자체를 서버에서
 * 불러오는 API 는 아직 없어(저장만 가능·조회 불가) 새 캔버스로 시작한다 — 후속 필요.
 */
export function useRestoreSession() {
  return useMutation({
    mutationFn: async (recoveryCode: string) => {
      const session = await restoreSession(recoveryCode);
      writeCachedSessionId(session.sessionId);
      clearLocalDraft();
      return session;
    },
  });
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
