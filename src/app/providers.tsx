'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { ApiError } from '@/shared/api';

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

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
