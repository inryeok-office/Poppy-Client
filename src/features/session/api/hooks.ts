import { useQuery } from '@tanstack/react-query';
import { useCallback, useRef, useState } from 'react';

import type { SerializedBlockProgram } from '@/features/simulation';
import { ApiError } from '@/shared/api';

import {
  readCachedSessionId,
  readLocalDraft,
  writeCachedSessionId,
  writeLocalDraft,
} from '../lib/localDraft';
import type { AutoSaveStatus, SessionInfo } from '../model/types';
import { createSession, saveProject } from './sessionApi';

async function ensureSession(): Promise<SessionInfo> {
  const cachedId = readCachedSessionId();
  if (cachedId) {
    const draft = readLocalDraft();
    // 재방문: 캐시된 세션의 마지막 버전을 초안에서 복원한다 (0으로 되돌리면 계속 409).
    return {
      sessionId: cachedId,
      projectVersion: draft?.sessionId === cachedId ? draft.projectVersion : 0,
    };
  }
  const created = await createSession();
  writeCachedSessionId(created.sessionId);
  return created;
}

/** 체험 세션을 확보한다 (캐시된 sessionId 재사용, 없으면 생성). */
export function useSession() {
  return useQuery({ queryKey: ['session'], queryFn: ensureSession, staleTime: Infinity });
}

/**
 * 단일 실행(single-flight) 자동 저장 큐 (명세 Session "프로젝트 자동 저장").
 *   - 저장은 한 번에 하나만. 진행 중 새 변경이 오면 끝난 뒤 최신 것만 저장한다.
 *   - 실패하면 브라우저에 임시 보관(`dirty`)하고 오프라인/충돌 상태를 알린다.
 *   - 세션이 아직 없어도 로컬 초안에는 기록한다.
 * 디바운스·변경 감지·초안 복원은 호출부(ExperienceView)가 담당한다.
 */
export function useAutoSaveProject(sessionId: string | null) {
  const [status, setStatus] = useState<AutoSaveStatus>('idle');
  const versionRef = useRef(0);
  const savingRef = useRef(false);
  const queuedRef = useRef<SerializedBlockProgram | null>(null);

  const setBaseVersion = useCallback((version: number) => {
    versionRef.current = version;
  }, []);

  const drain = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;

    let outcome: AutoSaveStatus = 'saved';
    while (queuedRef.current !== null) {
      const target = queuedRef.current;
      queuedRef.current = null;
      setStatus('saving');

      if (!sessionId) {
        writeLocalDraft({
          sessionId: '',
          program: target,
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
        versionRef.current = result.projectVersion;
        writeLocalDraft({
          sessionId,
          program: target,
          projectVersion: result.projectVersion,
          dirty: false,
        });
        outcome = 'saved';
      } catch (error) {
        writeLocalDraft({
          sessionId,
          program: target,
          projectVersion: versionRef.current,
          dirty: true,
        });
        outcome = error instanceof ApiError && error.status === 409 ? 'conflict' : 'offline';
        break;
      }
    }

    setStatus(outcome);
    savingRef.current = false;
  }, [sessionId]);

  const save = useCallback(
    (program: SerializedBlockProgram) => {
      queuedRef.current = program;
      void drain();
    },
    [drain],
  );

  return { status, save, setBaseVersion };
}
