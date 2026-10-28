import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SerializedBlockProgram } from '@/features/simulation';
import {
  ApiError,
  clearSessionCredentials,
  describeErrorCode,
  readSessionCredentials,
} from '@/shared/api';

import { expireIdleExperience, resetExperienceStorage } from '../lib/experienceLifecycle';
import {
  clearCachedSessionId,
  clearLocalDraft,
  readCachedSessionId,
  touchExperienceActivity,
  writeCachedSessionId,
  writeLocalDraft,
} from '../lib/localDraft';
import type { AutoSaveStatus, SessionInfo } from '../model/types';
import {
  InvalidProgramError,
  createSession,
  getSession,
  restoreSession,
  saveProject,
} from './sessionApi';

/** Server 가 "그 세션은 없다"고 답한 상태 — 저장된 credential 을 버리고 새로 만든다. */
const SESSION_GONE_STATUSES = new Set([401, 404, 410]);

async function ensureSession(): Promise<SessionInfo> {
  // 마지막 활동 후 15분이 지난 기록은 이전 체험자의 것으로 보고 버린다.
  expireIdleExperience();

  const cachedId = readCachedSessionId();
  const credentials = readSessionCredentials();
  if (cachedId && credentials?.sessionId === cachedId) {
    try {
      const current = await getSession(cachedId);
      if (current.status === 'ACTIVE') {
        touchExperienceActivity();
        return { ...credentials, projectVersion: current.blockVersion };
      }
    } catch (error) {
      const gone =
        error instanceof ApiError &&
        error.status !== undefined &&
        SESSION_GONE_STATUSES.has(error.status);
      // 네트워크 오류 등 — 세션이 사라졌다는 증거가 없으니 그대로 이어서 쓴다(오프라인 보관).
      if (!gone) return { ...credentials, projectVersion: credentials.currentBlockVersion };
    }
    // 만료·삭제된 세션 — 조용히 지우고 새로 만든다. 같은 체험의 블록 초안은 남겨 새 세션에 저장한다.
    clearSessionCredentials();
    clearCachedSessionId();
  }

  const created = await createSession();
  writeCachedSessionId(created.sessionId);
  touchExperienceActivity();
  return created;
}

export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: ensureSession, staleTime: Infinity });
}

/**
 * 새 체험 시작 — 이 브라우저의 블록 초안·세션 credential 을 모두 지우고, 메모리에 남은 세션도 버린다.
 * 다음에 체험 화면에 들어가면 새 세션이 만들어진다. 화면에서 세션을 쓰는 컴포넌트가 없을 때
 * (인트로 등) 호출한다 — 체험 화면 안에서는 storage 만 지우고 인트로로 이동한다.
 */
export function useStartNewExperience() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    resetExperienceStorage();
    queryClient.removeQueries({ queryKey: ['session'] });
  }, [queryClient]);
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
  const queryClient = useQueryClient();
  return useMutation({
    // 메모리에 남은 이전 세션 대신, 방금 복구한 세션을 다시 읽게 한다.
    onSuccess: () => queryClient.removeQueries({ queryKey: ['session'] }),
    mutationFn: async (recoveryCode: string) => {
      const session = await restoreSession(recoveryCode);
      writeCachedSessionId(session.sessionId);
      clearLocalDraft();
      touchExperienceActivity();
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
  const keepLocal = useCallback(
    (program: SerializedBlockProgram, snapshot?: unknown, reason?: string) => {
      queuedRef.current = null;
      writeLocalDraft({
        sessionId: sessionIdRef.current ?? '',
        program,
        blocks: snapshot,
        projectVersion: versionRef.current,
        dirty: true,
      });
      setRejectReason(reason ?? null);
      setStatus('invalid');
    },
    [],
  );

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
