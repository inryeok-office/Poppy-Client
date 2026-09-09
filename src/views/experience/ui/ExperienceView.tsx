import { BlockPalette } from './BlockPalette';
import { BlockWorkspace } from './BlockWorkspace';
import { ExperienceHeader } from './ExperienceHeader';
import { RobotPreview } from './RobotPreview';

/**
 * 블록 코딩 체험 화면 (Figma "뽀샤" node 21:520).
 *
 * 영역 구조 + 정적 스타일(피그마 Dev 모드 기준)까지 반영한 상태.
 * - 색은 globals.css @theme 팔레트(page/card/line/ink/muted/block-*)를 쓴다.
 * - 폰트는 디자인 지정대로 Gmarket Sans Medium(font-gmarket). 이 화면만 예외, 앱 기본은 그리운.
 * - 블록 드래그앤드롭, 시뮬레이션, 로봇 실행, 미리보기 렌더링 등 상호작용/상태는 범위 밖.
 *   블록 형태는 Figma 벡터 경로 그대로(Block.tsx), 조립 예시는 자리표시로 절대배치.
 * - 프레임의 브라우저 크롬(Topbar)·작업표시줄(Task bar)은 목업이라 제외.
 */
export function ExperienceView() {
  return (
    <div className="bg-page font-gmarket text-ink flex min-h-full flex-1 flex-col">
      <ExperienceHeader />
      {/* 본문: 좌 팔레트 · 중앙 워크스페이스 · 우 미리보기 3분할.
          각 영역의 폭·경계선은 해당 컴포넌트 루트가 소유한다(여긴 3분할 flex만). */}
      <div className="flex flex-1">
        <BlockPalette />
        <BlockWorkspace />
        <RobotPreview />
      </div>
    </div>
  );
}
