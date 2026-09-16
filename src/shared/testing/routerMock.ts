import { vi } from 'vitest';

// next/navigation 은 실제 App Router 트리 없이 렌더하면 "invariant expected app router to be
// mounted" 로 죽는다. vitest.setup.ts 가 이 mockRouter 로 next/navigation 을 전역 대체하고,
// 네비게이션을 검증해야 하는 테스트는 여기서 mockRouter 를 그대로 가져다 assert 한다.
export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

export function resetMockRouter(): void {
  mockRouter.push.mockClear();
  mockRouter.replace.mockClear();
  mockRouter.back.mockClear();
  mockRouter.forward.mockClear();
  mockRouter.refresh.mockClear();
  mockRouter.prefetch.mockClear();
}
