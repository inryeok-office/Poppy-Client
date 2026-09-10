import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import type { SerializedBlockProgram } from '@/features/simulation';
import { ApiError } from '@/shared/api';

import { readCachedSessionId, writeCachedSessionId, writeLocalDraft } from '../lib/localDraft';
import type { AutoSaveStatus, SessionInfo } from '../model/types';
import { createSession, saveProject } from './sessionApi';

const AUTOSAVE_DEBOUNCE_MS = 600;

async function ensureSession(): Promise<SessionInfo> {
  const cached = readCachedSessionId();
  if (cached) return { sessionId: cached, projectVersion: 0 };
  const created = await createSession();
  writeCachedSessionId(created.sessionId);
  return created;
}

/** 체험 세션을 확보한다 (캐시된 sessionId 재사용, 없으면 생성). */
export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: ensureSession, staleTime: Infinity });
}

/**
 * program 이 바뀌면 디바운스 후 서버에 저장한다 (명세 Session "프로젝트 자동 저장").
 * 실패하면 브라우저에 임시 보관하고 오프라인 상태를 알린다.
 */
export function useAutoSaveProject(sessionId: string | null, program: SerializedBlockProgram) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const versionRef = useRef(0);
  const skipNext = useRef(true);

  useEffect(() => {
    if (!sessionId) return;
    // 첫 program(초기 상태)은 '변경'이 아니므로 저장하지 않는다.
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      setStatus('saving');
      saveProject(sessionId, { program, baseVersion: versionRef.current })
        .then((result) => {
          versionRef.current = result.projectVersion;
          writeLocalDraft({
            sessionId,
            program,
            projectVersion: result.projectVersion,
            dirty: false,
          });
          setStatus('saved');
        })
        .catch((error: unknown) => {
          writeLocalDraft({ sessionId, program, projectVersion: versionRef.current, dirty: true });
          setStatus(error instanceof ApiError && error.status === 409 ? 'conflict' : 'offline');
        });
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [sessionId, program]);

  return { status };
}
