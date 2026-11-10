// 미션 기능이 현재 작동하지 않아(행사 회고) 기본으로 숨긴다. 값을 "true"로 주면
// 첫 화면 진입점·/missions 라우트·편집기의 미션 모드를 다시 켤 수 있다.
export function isMissionsEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MISSIONS_ENABLED === 'true';
}
