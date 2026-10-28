// 블록 조립 단계 안내 (캔버스 위 한 줄 띠). 프로그램 상태로 자동 진행한다.

export type GuideStep = 1 | 2 | 3 | 4;

export const GUIDE_TEXT: Record<GuideStep, string> = {
  1: '왼쪽에서 블록을 끌어 ‘시작’ 아래에 붙여 보세요',
  2: '숫자 칸을 눌러 거리·각도를 바꿀 수 있어요',
  3: '‘시뮬레이션 하기’로 미리 확인해요',
  4: '‘로봇 실행하기’를 누르면 진짜 로봇이 움직여요!',
};

export function guideStep({
  blockCount,
  valueEdited,
  simulationPassed,
}: {
  /** 시작·종료를 뺀 블록 수 */
  blockCount: number;
  /** 이번 체험에서 블록 값을 한 번이라도 바꿨는지 */
  valueEdited: boolean;
  simulationPassed: boolean;
}): GuideStep {
  if (simulationPassed) return 4;
  if (valueEdited || blockCount >= 2) return 3;
  if (blockCount >= 1) return 2;
  return 1;
}

/** 미션 권장 구성("시작 → 앞으로 이동 → …")을 힌트 블록 목록으로 — 숫자 값은 '?' 로 가린다. */
export function hintSteps(composition: string): string[] {
  return composition
    .split('→')
    .map((step) => step.trim().replace(/\d+(\.\d+)?/g, '?'))
    .filter((step) => step && step !== '시작' && step !== '종료');
}
