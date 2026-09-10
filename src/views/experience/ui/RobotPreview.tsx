// Figma node 21:520 (Dev 모드 좌표 그대로). 격자 박스(Rectangle 19) 기준 상대 좌표:
//   격자선  Frame 19 세로줄 x=21..229 / Frame 20 가로줄 y=11..167 (둘 다 26px 간격)
//   로봇 본체 Rectangle 20  x=105 y=89  40×52   (중심 x=125 = 세로 중앙선, top=89 = 가로 중앙선)
//   삼각형   Rectangle 21  x=117 y=65  16×16 프레임, 실제 벡터는 13.5×13.5 (좌 7.71% · 상 15.45% 인셋)
//   전체화면 아이콘 x=213 y=142 24×24 → 우/하 12px
// 패널: 폭 313(좌측 구분선 1.5 + 좌패딩 30.5 + 콘텐츠 249 + 우패딩 32), 상패딩 18.
// 제목/격자박스/스탯 세로 배치: 제목 y18(h16) → 격자박스 y46(h178) → 스탯 y256 (행 18 · 피치 34).
// 색은 globals.css @theme 팔레트, 폰트는 상위 font-gmarket 상속.

type RobotPreviewProps = {
  /** 시뮬레이션이 계산한 총 이동 거리 (m). 실행 전에는 0. */
  estimatedDistanceM?: number;
  /** 현재 프로그램의 블록(명령) 수 — 편집하면 실시간으로 바뀐다. */
  blockCount?: number;
};

// Figma: 5블록 프로그램 = "예상 실행 7초". 블록당 대략 1.4초로 잡는다.
const SECONDS_PER_BLOCK = 1.4;

export function RobotPreview({ estimatedDistanceM = 0, blockCount = 0 }: RobotPreviewProps) {
  const estimatedSeconds = Math.max(1, Math.round(blockCount * SECONDS_PER_BLOCK));
  const stats = [
    { label: '자세', value: '서있기' },
    { label: '바라보는 방향', value: '정면' },
    { label: '예상 이동 거리', value: `${estimatedDistanceM.toFixed(1)} m` },
  ];

  return (
    <aside
      aria-label="로봇 미리보기"
      className="border-line flex w-[313px] shrink-0 flex-col border-l-[1.5px] pt-[18px] pr-8 pl-[30.5px]"
    >
      {/* 헤더: 제목 + 요약. Figma 텍스트 높이 16 기준이라 leading-none 으로 여백 슬랙 제거 */}
      <div className="flex items-baseline justify-between leading-none">
        <h2 className="text-ink text-[14px]">로봇 미리보기</h2>
        <span className="text-muted text-[12px]">
          블록 {blockCount}개 • 예상 실행 {estimatedSeconds}초
        </span>
      </div>

      {/* 격자 박스 (Rectangle 19: 249×178 · radius 12). 제목 텍스트(하단 y32) 아래 14px → y46. */}
      <div
        role="img"
        aria-label="로봇 위치 미리보기 (2m × 2m 안전 구역)"
        className="border-line bg-card relative mt-[14px] h-[178px] w-full overflow-hidden rounded-[12px] border"
      >
        {/* 격자선: Frame 19 세로줄 x=21부터 · Frame 20 가로줄 y=11부터 · 26px 간격 (박스 기준 절대 위치). */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,#e4ddd2_1px,transparent_1px),linear-gradient(to_bottom,#e4ddd2_1px,transparent_1px)] bg-size-[26px_26px] bg-position-[21px_11px] opacity-70"
        />

        <span className="text-muted absolute top-3 left-3 text-[12px]">2m x 2m 안전 구역</span>

        {/* 로봇 본체 (Rectangle 20: x=105 y=89 · 40×52). 중심 x=125 = 격자 세로 중앙선. */}
        <span className="bg-ink absolute top-[89px] left-[105px] h-13 w-10 rounded-t-[18px] rounded-b-[7px]" />
        {/* 방향 삼각형 (Rectangle 21 벡터: 프레임 x=117 y=65 16×16, 인셋 좌7.71%·상15.45% → x=118.2 y=67.5). */}
        <svg
          aria-hidden
          viewBox="0 -0.6 13.533 14.13"
          className="absolute top-[67.5px] left-[118.2px] size-[13.5px] fill-[#e58d55]"
        >
          <path d="M2.00258 13.5279H11.5304C13.0172 13.5279 13.9842 11.9632 13.3193 10.6334L8.55537 1.10557C7.81832 -0.368525 5.71471 -0.368523 4.97766 1.10557L0.213726 10.6334C-0.451175 11.9632 0.515817 13.5279 2.00258 13.5279Z" />
        </svg>

        <button
          type="button"
          aria-label="미리보기 전체화면"
          className="text-muted hover:text-ink absolute right-3 bottom-3 grid size-6 cursor-pointer place-items-center rounded transition-colors"
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
        {stats.map((stat) => (
          <div key={stat.label} className="flex h-[18px] items-baseline justify-between">
            <dt className="text-muted text-[15px]">{stat.label}</dt>
            <dd className="text-ink text-[16px]">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
