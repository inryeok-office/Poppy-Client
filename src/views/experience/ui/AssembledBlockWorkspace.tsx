import { Block, BlockInput, CBlock, GhostBlock } from './Block';
import { SectionLabel } from './SectionLabel';
import { PillButton } from '@/shared/ui';

// Figma node 33:483 (Slide 16:9 - 3) — 조립 완료 상태.
// BlockWorkspace(페이지 2, node 21:520)와 두 가지만 다르다:
//   1. 종료 블록(Group 11)이 캔버스 우측에서 떨어져 있지 않고 인사하기 아래에 연결됨
//   2. 시뮬레이션 하기(Frame 17)가 아웃라인 → 채워진 primary 버튼(#ba7448)
// 튜토리얼 패널·안내문·건너뛰기·로봇 실행 버튼은 페이지 2와 동일.

export function AssembledBlockWorkspace() {
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

      {/* 안내문 + 실행 버튼. 조립이 끝나 '시뮬레이션 하기'가 활성(primary). */}
      <div className="flex items-center justify-between px-8 py-[18px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]">
          <span aria-hidden className="bg-block-start size-3 rounded-full" />
          반드시 &lsquo;종료&rsquo; 블록으로 끝내주세요.
        </p>
        {/* primary(상하 12)가 잠김 버튼(상하 11)보다 살짝 커서 center 정렬 (Figma Frame 17). */}
        <div className="flex items-center gap-2">
          <PillButton variant="primary">시뮬레이션 하기</PillButton>
          {/* 시뮬레이션 통과 전까지 잠김 — 상태는 범위 밖, 디자인대로 라벨만 */}
          <PillButton>
            로봇 실행하기<span className="text-[13px]">• 잠김</span>
          </PillButton>
        </div>
      </div>

      {/* 블록 조립 캔버스 (Rectangle 7). 시작~종료가 하나로 연결된 완성 프로그램 (Group 10~14). */}
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
          <li>
            <Block color="start" variant="cap">
              종료
            </Block>
          </li>
        </ol>
      </div>
    </section>
  );
}
