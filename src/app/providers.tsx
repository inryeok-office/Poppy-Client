'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import { ApiError } from '@/shared/api';

// 개발 모드에선 기본으로 API 요청을 MSW mock 으로 처리한다 (백엔드 없음).
// 실제 백엔드를 붙이면 NEXT_PUBLIC_ENABLE_API_MOCK=false 로 끈다. 프로덕션에선 항상 꺼진다.
const API_MOCK_ENABLED =
  process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_ENABLE_API_MOCK !== 'false';

let mockStarted = false;

async function startApiMock() {
  // StrictMode 이중 실행에도 worker.start() 는 한 번만 (두 번째 호출은 MSW 가 예외를 던진다).
  if (mockStarted) return;
  mockStarted = true;
  const { worker } = await import('@/shared/api/msw/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
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

  useEffect(() => {
    if (API_MOCK_ENABLED) void startApiMock();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
