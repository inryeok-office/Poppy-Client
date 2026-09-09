import { Block, BlockInput, CBlock, GhostBlock } from './Block';
import { PillButton } from '@/shared/ui';

// Figma node 21:520 — Frame 18(튜토리얼 라벨), Rectangle 5(튜토리얼 패널 h258, 상하 경계선 1.5px),
// Frame 16(건너뛰기), Frame 8(안내문), Frame 17(시뮬레이션/실행 버튼),
// Rectangle 7 + Group 10~14(블록 조립 캔버스, 점 격자). 블록 형태는 Block.tsx(Figma 벡터 경로).
// 조립 블록은 자리표시라 Figma Group 위치대로 절대배치한다.

// 초록 점 + 텍스트 소제목 (Frame 8 / Frame 18).
function SectionLabel({ children }: { children: string }) {
  return (
    <span className="text-ink flex items-center gap-1.5 text-[14px]">
      <span aria-hidden className="bg-block-start size-3 rounded-full" />
      {children}
    </span>
  );
}

export function BlockWorkspace() {
  return (
    <section className="bg-page flex flex-1 flex-col" aria-label="블록 워크스페이스">
      {/* 튜토리얼 */}
      <div>
        <div className="flex items-center justify-between px-8 py-[18px]">
          <SectionLabel>튜토리얼</SectionLabel>
          <PillButton>건너뛰기</PillButton>
        </div>
        {/* 목표 블록 예시 (Group 8·9) */}
        <div className="border-line bg-card dot-grid h-[258px] border-y-[1.5px] px-8 pt-[26px]">
          <ol className="flex flex-col -space-y-1.5">
            <li>
              <Block color="start" variant="hat">
                시작
              </Block>
            </li>
            <li>
              <GhostBlock>다음 블록을 붙여주세요</GhostBlock>
            </li>
          </ol>
        </div>
      </div>

      {/* 안내문 + 실행 버튼 */}
      <div className="flex items-center justify-between px-8 py-[18px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]">
          <span aria-hidden className="bg-block-start size-3 rounded-full" />
          반드시 &lsquo;종료&rsquo; 블록으로 끝내주세요.
        </p>
        <div className="flex gap-2">
          <PillButton>시뮬레이션 하기</PillButton>
          {/* 시뮬레이션 통과 전까지 잠김 — 상태는 범위 밖, 디자인대로 라벨만 */}
          <PillButton>
            로봇 실행하기<span className="text-[13px]">• 잠김</span>
          </PillButton>
        </div>
      </div>

      {/* 블록 조립 캔버스 (Rectangle 7). 조립 예시는 Group 10~14 위치대로 절대배치. */}
      <div
        className="border-line bg-card dot-grid relative min-h-[453px] flex-1 border-t-[1.5px]"
        role="region"
        aria-label="블록 조립 캔버스"
      >
        <ol className="absolute top-[88px] left-[52px] flex flex-col -space-y-1.5">
          <li>
            <Block color="start" variant="hat">
              시작
            </Block>
          </li>
          <li>
            <CBlock
              color="flow"
              header={
                <>
                  <BlockInput />번 반복하기
                </>
              }
            >
              <Block color="move">
                뒤로 <BlockInput /> m 이동
              </Block>
            </CBlock>
          </li>
          <li>
            <Block color="action">인사하기</Block>
          </li>
        </ol>
        {/* 종료 블록 — 연결 안 된 채 우측에 떨어져 있음 (Group 11) */}
        <div className="absolute top-[174px] left-[325px]">
          <Block color="start" variant="cap">
            종료
          </Block>
        </div>
      </div>
    </section>
  );
}
