import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';

import { DEFAULT_ARENA, type ArenaConfig } from '../model/arena';
import { getArenaConfig } from './arenaApi';

export const ARENA_QUERY_KEY = ['arena-settings'] as const;
/** 현장에서 설정을 바꾸면 곧 따라오도록 1분마다 다시 묻는다(실패해도 6×6 으로 동작). */
export const ARENA_REFETCH_MS = 60_000;

/** 서버 조회값. 로딩 중·실패 시 6×6 기본값. */
export function useArenaSettings(): ArenaConfig {
  const { data } = useQuery({
    queryKey: ARENA_QUERY_KEY,
    queryFn: getArenaConfig,
    refetchInterval: ARENA_REFETCH_MS,
    retry: false,
  });
  return data ?? DEFAULT_ARENA;
}

const ArenaContext = createContext<ArenaConfig>(DEFAULT_ARENA);

/** 아래 화면(블록 입력칸 등)이 같은 공간 값을 보게 한다. Provider 밖이면 6×6 기본값. */
export function ArenaProvider({ arena, children }: { arena: ArenaConfig; children: ReactNode }) {
  return <ArenaContext.Provider value={arena}>{children}</ArenaContext.Provider>;
}

export const useArena = (): ArenaConfig => useContext(ArenaContext);
