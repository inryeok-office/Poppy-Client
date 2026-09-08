// Figma node 21:520 — text 로봇 미리보기(32:420), 블록 N개·예상 실행 N초(33:925),
// Group 15(2m×2m 그리드) + akar-icons:full-screen(33:947), Frame 24(스탯).
//
// ── 스타일 적용 예시 파일 ──
// - 이 영역의 폭·패딩·경계선(= 부모 안에서 자리잡는 스타일)은 이 파일 루트 <aside>가 소유한다.
//   ExperienceView 는 3분할 flex만 잡고 이 폭에 관여하지 않는다.
// - 색상은 아직 디자인 토큰이 없어 arbitrary value로 뒀다. 다른 영역에서도 반복되면
//   globals.css @theme 로 승격 권장: 잉크 #655344 / 보조 #a89d93 / 경계 #e4ddd2 / 카드 #fbf4ea.
// - 폰트는 body에서 그리운 경찰공평체를 상속(디자인은 Gmarket Sans였지만 앱 브랜드 폰트로 통일).

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
      className="flex w-[320px] shrink-0 flex-col gap-8 border-l border-[#e4ddd2] p-6"
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-medium text-[#655344]">로봇 미리보기</h2>
        <span className="text-[12px] text-[#a89d93]">
          블록 {SUMMARY.blockCount}개 • 예상 실행 {SUMMARY.estimatedSeconds}초
        </span>
      </div>

      {/* 2m × 2m 안전 구역 미리보기. TODO: 조립된 블록 실행 결과로 로봇 위치/경로 렌더링 */}
      <div
        role="img"
        aria-label="로봇 위치 미리보기 (2m × 2m 안전 구역)"
        className="relative h-[178px] overflow-hidden rounded-[12px] border border-[#e4ddd2] bg-[#fbf4ea]"
      >
        {/* 26px 격자 (디자인 Vector 4~15 간격) */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_right,#e4ddd2_1px,transparent_1px),linear-gradient(to_bottom,#e4ddd2_1px,transparent_1px)] bg-[length:26px_26px] opacity-70"
        />

        <span className="absolute top-2 left-3 text-[11px] text-[#a89d93]">2m x 2m 안전 구역</span>

        {/* 로봇 마커 (중앙 고정). TODO: 실제 좌표/방향 반영, 디자인의 본체+머리 형태로 교체 */}
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 h-[52px] w-[40px] -translate-x-1/2 -translate-y-1/2 rounded-[8px] bg-[#c98b5e]"
        />

        <button
          type="button"
          aria-label="미리보기 전체화면"
          className="absolute right-2 bottom-2 grid size-6 place-items-center rounded text-[#a89d93] transition-colors hover:text-[#655344]"
        >
          {/* akar-icons:full-screen (node 33:947) */}
          <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
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

      <dl className="flex flex-col gap-4">
        {STATS.map((stat) => (
          <div key={stat.label} className="flex items-baseline justify-between">
            <dt className="text-[15px] text-[#a89d93]">{stat.label}</dt>
            <dd className="text-[16px] text-[#655344]">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
