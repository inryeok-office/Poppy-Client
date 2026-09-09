import { AssembledBlockWorkspace } from './AssembledBlockWorkspace';
import { BlockPalette } from './BlockPalette';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';

/**
 * 블록 코딩 체험 화면 — 조립 완료 상태 (Figma "뽀샤" node 33:483, Slide 16:9 - 3).
 *
 * /experience(페이지 2)와 두 가지만 다르다:
 *   1. 종료 블록이 스택에 연결돼 완성된 프로그램 형태
 *   2. '시뮬레이션 하기'가 채워진 primary 버튼으로 활성화
 * 헤더·팔레트·로봇 미리보기는 페이지 2와 같은 컴포넌트를 재사용한다.
 * 상호작용/상태/로직은 범위 밖 — Figma Dev 모드 값대로만.
 */
export function ExperienceAssembledView() {
  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader />
      <div className="flex flex-1">
        <BlockPalette />
        <AssembledBlockWorkspace />
        <RobotPreview />
      </div>
    </div>
  );
}
