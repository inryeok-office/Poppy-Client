import {
  ARENA,
  describeHeading,
  type ArenaPoint,
  type Posture,
  type SimulationStep,
} from '@/features/simulation';

// Figma node 21:520 (Dev 모드 좌표 그대로). 격자 박스(Rectangle 19) 기준 상대 좌표:
//   격자선  Figma 의 장식용 26px 격자 대신, 실물 매트와 같은 0.5m 격자를 공간 안에 그린다(#71).
//   전체화면 아이콘 x=213 y=142 24×24 → 우/하 12px
// 패널: 폭 313(좌측 구분선 1.5 + 좌패딩 30.5 + 콘텐츠 249 + 우패딩 32), 상패딩 18.
// 제목/격자박스/스탯 세로 배치: 제목 y18(h16) → 격자박스 y46(h178) → 스탯 y256 (행 18 · 피치 34).
// 색은 globals.css @theme 팔레트, 폰트는 상위 font-gmarket 상속.

// 격자 박스 안 공간 그림: 왼쪽 위 (12, 9) 부터 공간 전체를 160 px 정사각형으로 그린다. 오른쪽에는 안내 문구와 전체화면 버튼이 있다.
const ARENA_LEFT_PX = 12;
const ARENA_TOP_PX = 9;
const PX_PER_M = 160 / ARENA.widthM;
const toPx = ({ xM, yM }: ArenaPoint) => ({
  x: ARENA_LEFT_PX + xM * PX_PER_M,
  y: ARENA_TOP_PX + (ARENA.depthM - yM) * PX_PER_M,
});

/** 실물 트랙 매트의 격자 간격 (m). 미리보기 격자도 같은 간격으로 그린다(#71). */
export const GRID_STEP_M = 0.5;

/** 공간 안쪽 격자선 위치 (m, 경계 제외). 1m 마다 굵게 그린다. */
function gridPositions(lengthM: number): { m: number; major: boolean }[] {
  const count = Math.round(lengthM / GRID_STEP_M);
  return Array.from({ length: count - 1 }, (_, index) => {
    const m = (index + 1) * GRID_STEP_M;
    return { m, major: Math.abs(m - Math.round(m)) < 1e-9 };
  });
}

const POSTURE_LABEL: Record<Posture, string> = { standing: '서있기', sitting: '앉기' };

type RobotPreviewProps = {
  /** 시작·종료를 뺀 블록 수 (반복은 한 번만 센다). */
  blockCount?: number;
  /** 예상 동작 시간 (s) — 이동 0.5 m/s, 회전 45°/s, 자세 3 s, 특수 동작 5 s, 대기값 합산. */
  estimatedSeconds?: number;
  /** 프로그램이 끝난 뒤 자세. */
  finalPosture?: Posture;
  /** 누적 회전 (오른쪽 +, 0~359°). */
  headingDegrees?: number;
  /** 프로그램의 총 이동 거리 (m) — 반복 포함. */
  estimatedDistanceM?: number;
  /** 출발점부터 이동 구간 끝점들 (m). 마지막 점이 최종 위치다. */
  path?: ArenaPoint[];
  /** 안전 구역을 벗어난 지점 (m). */
  failurePoint?: ArenaPoint | null;
  /** 방금 시뮬레이션한 실행순서 — 있을 때만 진행상태 바·성공/실패 배지를 보여준다. */
  steps?: SimulationStep[];
  /** steps 와 함께 준다 — 진행상태 문구·배지 색을 결정한다. */
  passed?: boolean;
};

export function RobotPreview({
  blockCount = 0,
  estimatedSeconds = 0,
  finalPosture = 'standing',
  headingDegrees = 0,
  estimatedDistanceM = 0,
  path = [{ xM: ARENA.startXM, yM: ARENA.startYM }],
  failurePoint = null,
  steps,
  passed,
}: RobotPreviewProps) {
  const stats = [
    { label: '자세', value: POSTURE_LABEL[finalPosture] },
    { label: '바라보는 방향', value: describeHeading(headingDegrees) },
    { label: '예상 이동 거리', value: `${estimatedDistanceM.toFixed(1)} m` },
  ];

  const hasResult = steps != null && passed != null;
  const total = steps?.length ?? 0;
  const doneCount = steps?.filter((s) => s.status === 'done').length ?? 0;
  const failedIndex = steps?.findIndex((s) => s.status === 'failed') ?? -1;
  const progressPct = total > 0 ? (doneCount / total) * 100 : 0;
  const zoneLabel = `안전 구역 ${ARENA.widthM}m × ${ARENA.depthM}m`;
  const pathPx = path.map(toPx);
  const finalPx = pathPx[pathPx.length - 1];
  const failurePx = failurePoint ? toPx(failurePoint) : null;
  const startPx = toPx({ xM: ARENA.startXM, yM: ARENA.startYM });

  return (
    <aside
      aria-label="로봇 미리보기"
      className="border-line flex w-[313px] shrink-0 flex-col border-l-[1.5px] pt-[18px] pr-8 pl-[30.5px]"
    >
      {/* 헤더: 제목(+ 성공/실패 배지) + 요약. Figma 텍스트 높이 16 기준이라 leading-none 으로 여백 슬랙 제거 */}
      <div className="flex items-baseline justify-between leading-none">
        <div className="flex items-baseline gap-2">
          <h2 className="text-ink text-[14px]">로봇 미리보기</h2>
          {hasResult && (
            <span
              className={`flex items-center gap-1 text-[13px] ${passed ? 'text-success' : 'text-danger'}`}
            >
              <span
                aria-hidden
                className={`flex size-4 items-center justify-center rounded-full text-[9px] text-white ${
                  passed ? 'bg-success' : 'bg-danger'
                }`}
              >
                {passed ? '✓' : '!'}
              </span>
              {passed ? '성공' : '실패'}
            </span>
          )}
        </div>
        <span className="text-muted text-[12px]">
          블록 {blockCount}개 • 예상 실행 {Math.ceil(estimatedSeconds)}초
        </span>
      </div>

      {/* 격자 박스 (Rectangle 19: 249×178 · radius 12). 제목 텍스트(하단 y32) 아래 14px → y46. */}
      <div
        role="img"
        aria-label={`로봇 위치 미리보기 (${zoneLabel}, 격자 ${GRID_STEP_M}m)`}
        className="border-line bg-card relative mt-[14px] h-[178px] w-full overflow-hidden rounded-[12px] border"
      >
        <span className="text-muted absolute top-3 right-3 w-[60px] text-right text-[12px] leading-tight">
          {zoneLabel}
        </span>

        {/* 공간 경계·0.5m 격자·벽 여유·출발점·경로·최종 위치와 방향·실패 지점.
            격자는 시뮬레이션 좌표(원점 왼쪽 아래, m)를 그대로 toPx 로 옮겨 실물 매트와 같은 0.5m 간격이다(#71). */}
        <svg aria-hidden viewBox="0 0 249 178" className="absolute inset-0 size-full">
          <g data-testid="arena-grid" className="stroke-[#e4ddd2]">
            {gridPositions(ARENA.widthM).map(({ m, major }) => {
              const { x } = toPx({ xM: m, yM: 0 });
              return (
                <line
                  key={`x${m}`}
                  data-axis="x"
                  data-m={m}
                  x1={x}
                  x2={x}
                  y1={ARENA_TOP_PX}
                  y2={ARENA_TOP_PX + ARENA.depthM * PX_PER_M}
                  strokeWidth={major ? 1 : 0.5}
                />
              );
            })}
            {gridPositions(ARENA.depthM).map(({ m, major }) => {
              const { y } = toPx({ xM: 0, yM: m });
              return (
                <line
                  key={`y${m}`}
                  data-axis="y"
                  data-m={m}
                  x1={ARENA_LEFT_PX}
                  x2={ARENA_LEFT_PX + ARENA.widthM * PX_PER_M}
                  y1={y}
                  y2={y}
                  strokeWidth={major ? 1 : 0.5}
                />
              );
            })}
          </g>
          <rect
            x={ARENA_LEFT_PX}
            y={ARENA_TOP_PX}
            width={ARENA.widthM * PX_PER_M}
            height={ARENA.depthM * PX_PER_M}
            className="stroke-ink fill-none"
          />
          <rect
            x={ARENA_LEFT_PX + ARENA.marginM * PX_PER_M}
            y={ARENA_TOP_PX + ARENA.marginM * PX_PER_M}
            width={(ARENA.widthM - 2 * ARENA.marginM) * PX_PER_M}
            height={(ARENA.depthM - 2 * ARENA.marginM) * PX_PER_M}
            strokeDasharray="4 3"
            className="stroke-muted fill-none"
          />
          <circle
            data-testid="arena-start"
            cx={startPx.x}
            cy={startPx.y}
            r={4}
            strokeWidth={1.5}
            className="stroke-success fill-none"
          />
          <text
            x={startPx.x - 6}
            y={startPx.y - 6}
            textAnchor="end"
            className="fill-success text-[8px]"
          >
            출발
          </text>
          <polyline
            data-testid="robot-path"
            points={pathPx.map(({ x, y }) => `${x},${y}`).join(' ')}
            strokeWidth={2}
            strokeLinejoin="round"
            className="stroke-ink fill-none"
          />
          <path
            data-testid="robot-heading"
            d="M0 -9 L6.5 6 L0 3 L-6.5 6 Z"
            transform={`translate(${finalPx.x} ${finalPx.y}) rotate(${headingDegrees})`}
            className="fill-[#e58d55]"
          />
          {failurePx && (
            <circle
              data-testid="robot-failure-point"
              cx={failurePx.x}
              cy={failurePx.y}
              r={5}
              className="fill-danger"
            />
          )}
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

      {/* 진행상태 — 방금 시뮬레이션했을 때만 (Figma Slide 6·7). */}
      {hasResult && total > 0 && (
        <div className="mt-8 flex flex-col gap-1">
          <div className="flex items-baseline justify-between leading-none">
            <span className="text-muted text-[15px]">진행상태</span>
            <span className="text-ink text-[16px]">
              {passed ? `${total}/${total} 단계 성공` : `${failedIndex + 1}번째 블록에서 멈춤`}
            </span>
          </div>
          <div className="bg-line relative mt-2 h-2 w-full overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full ${passed ? 'bg-success' : 'bg-danger'}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

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
