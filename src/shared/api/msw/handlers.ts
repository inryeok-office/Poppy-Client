import type { HttpHandler } from 'msw';

// 도메인 슬라이스가 생기면 여기에 나열하는 대신, 각 슬라이스의 handlers를 이 배열에 합친다.
// 예: export const handlers: HttpHandler[] = [...jobHandlers, ...memberHandlers];
export const handlers: HttpHandler[] = [];
