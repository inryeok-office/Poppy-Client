import { PillButton } from '@/shared/ui';

// Figma node 33:700 (Slide 16:9 - 4) — 조립 완료 + 시뮬레이션 통과, 로봇 실행 대기 상태.
// 페이지 3(AssembledBlockWorkspace)에서:
//   - 튜토리얼 패널이 없어 안내문이 워크스페이스 최상단 (Frame 8, y=223 → 헤더 아래 바로)
//   - 시뮬레이션 하기 / 로봇 실행하기 둘 다 채워진 primary 버튼, 잠김 없음 (Frame 17)
//   - 캔버스가 그만큼 커지고 조립 블록 입력칸에 값(2·1)이 채워짐
// 헤더 아래(y205) ~ 캔버스 상단(y257) 사이 52px 가 이 상단 행. 버튼 40 · 상하 6.

export function RunReadyWorkspace() {
  return (
    <section className="bg-page flex flex-1 flex-col" aria-label="블록 워크스페이스">
      {/* 안내문 + 실행 버튼 (Frame 8 · Frame 17). 헤더 바로 아래, 버튼 세로 중앙. */}
      <div className="flex items-center justify-between px-8 py-[6px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]">
          <span aria-hidden className="bg-block-start size-3 rounded-full" />
          반드시 &lsquo;종료&rsquo; 블록으로 끝내주세요.
        </p>
        <div className="flex items-center gap-2">
          <PillButton variant="primary">시뮬레이션 하기</PillButton>
          <PillButton variant="primary">로봇 실행하기</PillButton>
        </div>
      </div>

      {/* 조립 캔버스 — 조각 3 */}
    </section>
  );
}
