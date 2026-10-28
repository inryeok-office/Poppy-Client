// 체험자가 고른 미션 — 세션 API 에 미션을 저장하는 계약이 아직 없어 브라우저에만 보관한다.
const KEY = 'poppy.experience.missionId';

function store(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function readSelectedMissionId(): string | null {
  try {
    return store()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
}

export function writeSelectedMissionId(missionId: string): void {
  try {
    store()?.setItem(KEY, missionId);
  } catch {
    // 저장 공간이 막혀도 이번 화면 이동에는 지장이 없다.
  }
}

export function clearSelectedMissionId(): void {
  try {
    store()?.removeItem(KEY);
  } catch {
    // 무시
  }
}
