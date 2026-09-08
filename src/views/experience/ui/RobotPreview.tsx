// Figma node 21:520 — text 로봇 미리보기(32:420), 블록 N개·예상 실행 N초(33:925),
// Group 15(2m×2m 그리드) + akar-icons:full-screen(33:947), Frame 24(스탯).

// 디자인의 정적 값. TODO: 조립된 블록 상태에서 파생.
const SUMMARY = { blockCount: 5, estimatedSeconds: 7 } as const;
const STATS = [
  { label: '자세', value: '서있기' },
  { label: '바라보는 방향', value: '정면' },
  { label: '예상 이동 거리', value: '0.0 m' },
] as const;

export function RobotPreview() {
  return (
    <aside aria-label="로봇 미리보기">
      <div className="flex items-center justify-between">
        <h2>로봇 미리보기</h2>
        <span>
          블록 {SUMMARY.blockCount}개 · 예상 실행 {SUMMARY.estimatedSeconds}초
        </span>
      </div>

      {/* 2m × 2m 안전 구역 미리보기. TODO: 실제 로봇 위치/경로 렌더링 */}
      <div role="img" aria-label="로봇 위치 미리보기 (2m × 2m 안전 구역)">
        <span>2m x 2m 안전 구역</span>
        <button type="button" aria-label="미리보기 전체화면">
          전체화면
        </button>
      </div>

      <dl>
        {STATS.map((stat) => (
          <div key={stat.label} className="flex justify-between">
            <dt>{stat.label}</dt>
            <dd>{stat.value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
