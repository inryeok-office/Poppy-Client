import { setupServer } from 'msw/node';

import { handlers } from './handlers';

// Vitest(Node 환경)에서 axios 요청을 가로채는 MSW 서버. vitest.setup.ts가 생명주기를 관리한다.
export const server = setupServer(...handlers);
