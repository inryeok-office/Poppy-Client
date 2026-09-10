import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

// 브라우저에서 axios 요청을 가로채는 MSW 워커.
// NEXT_PUBLIC_ENABLE_API_MOCK=true 일 때만 app/providers 가 start() 한다.
export const worker = setupWorker(...handlers);
