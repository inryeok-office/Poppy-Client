import type { HttpHandler } from 'msw';

import { executionHandlers } from '@/features/execution';
import { simulationHandlers } from '@/features/simulation';

// 도메인 슬라이스가 늘어나면 각 슬라이스의 handlers 를 여기에 합친다.
export const handlers: HttpHandler[] = [...simulationHandlers, ...executionHandlers];
