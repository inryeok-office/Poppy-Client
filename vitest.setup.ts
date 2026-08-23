import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '@/shared/api/msw/server';

// jsdom엔 matchMedia가 없다. matchMedia에 의존하는 라이브러리(토스트 등)를 위해 최소 구현을 채운다.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

// 테스트가 정의하지 않은 요청은 명시적으로 실패시켜 놓친 Mock을 바로 드러낸다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// 테스트 간 MSW 핸들러와 DOM이 남아 다음 테스트에 영향을 주지 않게 한다.
afterEach(() => {
  server.resetHandlers();
  cleanup();
});

afterAll(() => server.close());
