// Figma node 21:520 — text 로봇 미리보기(32:420), 블록 N개·예상 실행 N초(33:925),
// Group 15(2m×2m 그리드, 26px 간격) + 로봇 본체 Rectangle 20(33:468, 40×52)·방향 삼각형 Rectangle 21(33:470),
// akar-icons:full-screen(33:947, 24×24), Frame 24(스탯 3행, gap 16).
//
// 이 영역의 폭(313)·좌측 경계선·패딩(32/18)은 이 파일 루트 <aside>가 소유한다.
// ExperienceView 는 3분할 flex + 페이지 배경만 잡고 이 폭에 관여하지 않는다.
// 색은 globals.css @theme 팔레트(page/card/line/ink/muted), 폰트는 상위의 font-gmarket 상속.

const SUMMARY = { blockCount: 5, estimatedSeconds: 7 } as const;

const STATS = [
  { label: '자세', value: '서있기' },
  { label: '바라보는 방향', value: '정면' },
  { label: '예상 이동 거리', value: '0.0 m' },
] as const;

export function RobotPreview() {
  return (
    <aside
      aria-label="로봇 미리보기"
      className="border-line flex w-[313px] shrink-0 flex-col border-l-[1.5px] px-8 pt-4.5"
    >
      {/* 헤더: 제목 + 요약. Figma 텍스트 높이 16 기준이라 leading-none 으로 여백 슬랙 제거 */}
      <div className="flex items-baseline justify-between leading-none">
        <h2 className="text-ink text-[14px]">로봇 미리보기</h2>
        <span className="text-muted text-[12px]">
          블록 {SUMMARY.blockCount}개 • 예상 실행 {SUMMARY.estimatedSeconds}초
        </span>
      </div>

      {/* 2m × 2m 안전 구역 미리보기. 헤더 아래 14px (Figma Group 15 y=251, 텍스트 y=223+16). */}
      <div
        role="img"
        aria-label="로봇 위치 미리보기 (2m × 2m 안전 구역)"
        className="border-line bg-card relative mt-[14px] h-[178px] overflow-hidden rounded-xl border"
      >
        {/* 26px 격자 (디자인 Frame 19·20). Figma는 격자를 박스 안에 가운데 맞춰(좌우 ~20·상하 ~11 여백)
            중앙 교차점에 로봇을 놓는다. 로봇이 top-1/2·left-1/2라서 x 20 · y 11 오프셋이면 중앙선이 로봇을 지난다. */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,#e4ddd2_1px,transparent_1px),linear-gradient(to_bottom,#e4ddd2_1px,transparent_1px)] bg-size-[26px_26px] bg-position-[20px_11px] opacity-70"
        />

        <span className="text-muted absolute top-3 left-3 text-[12px]">2m x 2m 안전 구역</span>

        {/* 로봇 마커. 본체(Rectangle 20) 상단이 박스 세로 중앙(y=340, 박스 251~429). TODO: 실제 좌표/방향 반영 */}
        <span className="bg-ink absolute top-1/2 left-1/2 h-13 w-10 -translate-x-1/2 rounded-t-[18px] rounded-b-[7px]" />
        {/* 방향 삼각형 (Rectangle 21 / 33:470, 13.5×13.5 벡터 그대로, 모서리 둥긂). 본체 위 ~9px */}
        <svg
          aria-hidden
          viewBox="0 -0.6 13.533 14.13"
          className="absolute top-1/2 left-1/2 size-[13.5px] -translate-x-1/2 -translate-y-[calc(100%+8px)] fill-[#e58d55]"
        >
          <path d="M2.00258 13.5279H11.5304C13.0172 13.5279 13.9842 11.9632 13.3193 10.6334L8.55537 1.10557C7.81832 -0.368525 5.71471 -0.368523 4.97766 1.10557L0.213726 10.6334C-0.451175 11.9632 0.515817 13.5279 2.00258 13.5279Z" />
        </svg>

        <button
          type="button"
          aria-label="미리보기 전체화면"
          className="text-muted absolute right-3 bottom-3 grid size-6 place-items-center rounded"
        >
          {/* akar-icons:full-screen (node 33:947) */}
          <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
            <path
              d="M4 8V4H8M20 8V4H16M8 20H4V16M16 20H20V16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* 스탯 3행 (Frame 24). 격자 박스 아래 32px, 각 행 18px · 행 간격 16 → 34 피치 (Figma) */}
      <dl className="mt-8 flex flex-col gap-4 leading-none">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex h-[18px] items-baseline justify-between">
            <dt className="text-muted text-[15px]">{stat.label}</dt>
            <dd className="text-ink text-[16px]">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
