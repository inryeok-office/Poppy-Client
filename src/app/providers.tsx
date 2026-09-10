'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { ApiError } from '@/shared/api';

// 개발 모드에선 기본으로 API 요청을 MSW mock 으로 처리한다 (백엔드 없음).
// 실제 백엔드를 붙이면 NEXT_PUBLIC_ENABLE_API_MOCK=false 로 끈다. 프로덕션에선 항상 꺼진다.
const API_MOCK_ENABLED =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_API_MOCK !== 'false';

let mockStartPromise: Promise<unknown> | null = null;

/** 워커를 딱 한 번 시작한다 (StrictMode 이중 실행에도 같은 promise 를 재사용). */
function startApiMock() {
  mockStartPromise ??= import('@/shared/api/msw/browser').then(({ worker }) =>
    worker.start({ onUnhandledRequest: 'bypass' }),
  );
  return mockStartPromise;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        // 4xx는 다시 요청해도 같은 결과다. 서버 오류와 네트워크 실패만 재시도한다.
        retry: (failureCount, error) => {
          const status = error instanceof ApiError ? error.status : undefined;
          if (status !== undefined && status >= 400 && status < 500) return false;
          return failureCount < 2;
        },
      },
    },
  });
}

export function Providers({ children }: { children: ReactNode }) {
  // 요청마다 새 QueryClient를 만들어 서버에서 사용자 간 캐시가 섞이지 않게 한다.
  const [queryClient] = useState(createQueryClient);
  // mock 을 켰다면 워커가 준비될 때까지 렌더를 미룬다 (초기 요청이 실제 백엔드로 새는 걸 방지).
  const [mockReady, setMockReady] = useState(!API_MOCK_ENABLED);

  useEffect(() => {
    if (!API_MOCK_ENABLED) return;
    let cancelled = false;
    void startApiMock().then(() => {
      if (!cancelled) setMockReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!mockReady) return null;

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
