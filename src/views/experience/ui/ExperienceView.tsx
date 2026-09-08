import { BlockPalette } from './BlockPalette';
import { BlockWorkspace } from './BlockWorkspace';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';

/**
 * 블록 코딩 체험 화면 (Figma "뽀샤" node 21:520).
 *
 * 골격 단계: 영역 구조 + 디자인 텍스트만 배치한다.
 * - 색·간격·타이포 등 시각 스타일은 후속 작업(피그마 Dev 모드 기준).
 * - 아래 flex 클래스는 영역 배치를 잡기 위한 최소 스캐폴딩이며 교체 대상이다.
 * - 블록 드래그앤드롭, 시뮬레이션, 로봇 실행, 미리보기 렌더링 등 상호작용/상태는 범위 밖.
 * - 프레임의 브라우저 크롬(Topbar)·작업표시줄(Task bar)은 목업이라 제외.
 */
export function ExperienceView() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <ExperienceHeader />
      {/* 본문: 좌 팔레트 · 중앙 워크스페이스 · 우 미리보기 3분할 */}
      <div className="flex flex-1">
        <BlockPalette />
        <BlockWorkspace />
        <RobotPreview />
      </div>
    </div>
  );
}
