// Figma node 21:520 — Rectangle 5(튜토리얼 패널), Frame 16(건너뛰기), Frame 8(안내문),
// Frame 17(시뮬레이션/실행 버튼), Rectangle 7 + Group 10~14(블록 조립 캔버스).

// 캔버스에 조립된 블록 예시(디자인 기준). 실제로는 사용자가 팔레트에서 끌어와 구성.
const SAMPLE_PROGRAM = ['시작', '번 반복하기', '뒤로 m 이동', '인사하기', '종료'] as const;

export function BlockWorkspace() {
  return (
    <section className="flex flex-1 flex-col" aria-label="블록 워크스페이스">
      {/* 튜토리얼 패널 */}
      <div>
        <div className="flex items-center justify-between">
          <span>튜토리얼</span>
          <button type="button">건너뛰기</button>
        </div>
        {/* 목표 블록 예시 */}
        <ol>
          <li>시작</li>
          <li>다음 블록을 붙여주세요</li>
        </ol>
      </div>

      {/* 안내문 + 실행 버튼 */}
      <div className="flex items-center justify-between">
        <p>반드시 &lsquo;종료&rsquo; 블록으로 끝내주세요.</p>
        <div className="flex">
          <button type="button">시뮬레이션 하기</button>
          {/* 시뮬레이션 통과 전까지 잠김 */}
          <button type="button" disabled>
            로봇 실행하기 <span>· 잠김</span>
          </button>
        </div>
      </div>

      {/* 블록 조립 캔버스 */}
      <div className="flex-1" role="region" aria-label="블록 조립 캔버스">
        <ol>
          {SAMPLE_PROGRAM.map((block, index) => (
            <li key={`${block}-${index}`}>{block}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
