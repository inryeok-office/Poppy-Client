import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SerializedBlockProgram } from '@/features/simulation';
import { ApiError, describeErrorCode, readSessionCredentials } from '@/shared/api';

import {
  clearLocalDraft,
  readCachedSessionId,
  writeCachedSessionId,
  writeLocalDraft,
} from '../lib/localDraft';
import type { AutoSaveStatus, SessionInfo } from '../model/types';
import { InvalidProgramError, createSession, restoreSession, saveProject } from './sessionApi';

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

/** 세션이 사라졌다는 응답 — 새 세션을 만들어 다시 저장한다. */
const SESSION_LOST_STATUSES = new Set([401, 404, 410]);

function classifyFailure(error: unknown): { status: AutoSaveStatus; reason: string | null } {
  if (error instanceof InvalidProgramError) return { status: 'invalid', reason: null };
  if (error instanceof ApiError && error.status === 409)
    return { status: 'conflict', reason: null };
  if (
    error instanceof ApiError &&
    error.status !== undefined &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return { status: 'rejected', reason: describeErrorCode(error.code) };
  }
  // 응답 없음(네트워크)·5xx
  return { status: 'offline', reason: null };
}

export function useAutoSaveProject(sessionId: string | null) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [projectVersion, setProjectVersion] = useState(0);
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<QueuedSave | null>(null);
  const drainPromiseRef = useRef<Promise<number> | null>(null);
  const sessionIdRef = useRef(sessionId);
  // 저장 실패 복구로 이 훅이 직접 만든 세션 — 그 세션의 버전은 이미 알고 있으니 바깥에서
  // 다시 기준 버전을 덮어쓰지 않게 한다(새 세션 기준 0 으로 되돌아가 409 가 나는 것 방지).
  const recoveredSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  /** 서버가 알려준 기준 버전을 맞춘다. 복구로 만든 세션이면 false(이미 맞춰져 있음). */
  const setBaseVersion = useCallback((version: number, forSessionId?: string): boolean => {
    if (forSessionId !== undefined && forSessionId === recoveredSessionIdRef.current) return false;
    versionRef.current = version;
    setProjectVersion(version);
    return true;
  }, []);

  const drain = useCallback((): Promise<number> => {
    if (drainPromiseRef.current) return drainPromiseRef.current;

    const run = async (): Promise<number> => {
      if (savingRef.current) return versionRef.current;
      savingRef.current = true;

      let outcome: AutoSaveStatus = 'saved';
      let reason: string | null = null;
      let recovered = false;
      while (queuedRef.current !== null) {
        const { program: target, snapshot } = queuedRef.current;
        queuedRef.current = null;
        setStatus('saving');
        const currentSessionId = sessionIdRef.current;

        if (!currentSessionId) {
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
          const result = await saveProject(currentSessionId, {
            program: target,
            baseVersion: versionRef.current,
          });
          versionRef.current = result.blockVersion;
          setProjectVersion(result.blockVersion);
          writeLocalDraft({
            sessionId: currentSessionId,
            program: target,
            blocks: snapshot,
            projectVersion: result.blockVersion,
            dirty: false,
          });
          outcome = 'saved';
          reason = null;
        } catch (error) {
          writeLocalDraft({
            sessionId: currentSessionId,
            program: target,
            blocks: snapshot,
            projectVersion: versionRef.current,
            dirty: true,
          });
          if (
            !recovered &&
            error instanceof ApiError &&
            error.status !== undefined &&
            SESSION_LOST_STATUSES.has(error.status)
          ) {
            // 세션이 만료·삭제됐다 — 새 세션을 만들고 지금 블록을 그 세션에 다시 저장한다(1회).
            recovered = true;
            try {
              const created = await createSession();
              writeCachedSessionId(created.sessionId);
              recoveredSessionIdRef.current = created.sessionId;
              sessionIdRef.current = created.sessionId;
              versionRef.current = created.projectVersion;
              setProjectVersion(created.projectVersion);
              queryClient.setQueryData(['session'], created);
              queuedRef.current = queuedRef.current ?? { program: target, snapshot };
              continue;
            } catch {
              outcome = 'offline';
              break;
            }
          }
          ({ status: outcome, reason } = classifyFailure(error));
          break;
        }
      }

      setRejectReason(outcome === 'rejected' ? reason : null);
      setStatus(outcome);
      savingRef.current = false;
      return versionRef.current;
    };

    const promise = run().finally(() => {
      drainPromiseRef.current = null;
    });
    drainPromiseRef.current = promise;
    return promise;
  }, [queryClient]);

  const save = useCallback(
    (program: SerializedBlockProgram, snapshot?: unknown) => {
      queuedRef.current = { program, snapshot };
      void drain();
    },
    [drain],
  );

  /** 구조 오류가 있는 프로그램 — 서버에 보내지 않고 브라우저에만 보관한다. */
  const keepLocal = useCallback((program: SerializedBlockProgram, snapshot?: unknown) => {
    queuedRef.current = null;
    writeLocalDraft({
      sessionId: sessionIdRef.current ?? '',
      program,
      blocks: snapshot,
      projectVersion: versionRef.current,
      dirty: true,
    });
    setRejectReason(null);
    setStatus('invalid');
  }, []);

  return {
    status,
    rejectReason,
    save,
    keepLocal,
    flush: drain,
    setBaseVersion,
    projectVersion,
  };
}
