import { BlockPalette } from './BlockPalette';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';
import { RunReadyWorkspace } from './RunReadyWorkspace';

/**
 * 블록 코딩 체험 화면 — 로봇 실행 대기 상태 (Figma "뽀샤" node 33:700, Slide 16:9 - 4).
 *
 * /experience/assembled(페이지 3)에서:
 *   1. 튜토리얼 패널이 사라지고 안내문이 워크스페이스 최상단으로
 *   2. '시뮬레이션 하기' · '로봇 실행하기' 둘 다 채워진 primary 버튼 (시뮬레이션 통과, 잠김 해제)
 *   3. 조립 블록 입력칸에 값(반복 2 · 뒤로 1 m)이 채워짐
 * 헤더·팔레트·로봇 미리보기는 페이지 2·3과 같은 컴포넌트를 재사용한다.
 * 상호작용/상태/로직은 범위 밖 — Figma Dev 모드 값대로만.
 */
export function ExperienceRunReadyView() {
  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader />
      <div className="flex flex-1">
        <BlockPalette />
        <RunReadyWorkspace />
        <RobotPreview />
      </div>
    </div>
  );
}
