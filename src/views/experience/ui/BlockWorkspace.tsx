import {
  MOVE_RANGE,
  REPEAT_RANGE,
  type BlockError,
  type BlockProgram,
} from '../model/blockProgram';
import { Block, BlockInput, CBlock, GhostBlock } from './Block';
import { SectionLabel } from './SectionLabel';
import { PillButton } from '@/shared/ui';

// Figma node 21:520 / 33:483 (Slide 2·3) — 블록 조립 워크스페이스, 시뮬레이션 통과 전.
//   프로그램에 구조 오류가 있으면(예: '종료' 미연결) '시뮬레이션 하기' 비활성(아웃라인) + 안내문이 오류 메시지.
//   떨어진 '종료' 블록을 누르면 스택 끝에 연결된다 (임시 편집 — 전체 드래그앤드롭은 후속 조각).
// 시뮬레이션 상태는 ExperienceView 가 소유한다.

const DEFAULT_HINT = '반드시 ‘종료’ 블록으로 끝내주세요.';

type BlockWorkspaceProps = {
  program: BlockProgram;
  errors: BlockError[];
  /** 떨어진 블록 클릭 → 스택 끝에 연결 */
  onConnectBlock?: () => void;
  onRepeatCountChange?: (next: number) => void;
  onMoveDistanceChange?: (next: number) => void;
  onSimulate?: () => void;
  /** 시뮬레이션 검증 중 — 버튼 라벨을 바꾸고 재클릭을 막는다. */
  simulating?: boolean;
  /** 시뮬레이션이 통과하지 못한 이유 (안전 제한 위반 / 요청 실패). */
  simulationMessage?: string;
};

export function BlockWorkspace({
  program,
  errors,
  onConnectBlock,
  onRepeatCountChange,
  onMoveDistanceChange,
  onSimulate,
  simulating = false,
  simulationMessage,
}: BlockWorkspaceProps) {
  const valid = errors.length === 0;
  const hint = simulationMessage ?? errors[0]?.message ?? DEFAULT_HINT;
  const endConnected = program.chain.at(-1) === 'end';
  const endDetached = program.detached.includes('end');

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

      {/* 안내문(구조 오류 시 오류 메시지) + 실행 버튼. */}
      <div className="flex items-center justify-between px-8 py-[18px]">
        <p className="text-ink flex items-center gap-1.5 text-[14px]" aria-live="polite">
          <span aria-hidden className="bg-block-start size-3 rounded-full" />
          {hint}
        </p>
        {/* primary(상하 12)가 잠김 버튼(상하 11)보다 살짝 커서 center 정렬 (Figma Frame 17). */}
        <div className="flex items-center gap-2">
          {valid ? (
            <PillButton variant="primary" onClick={onSimulate}>
              {simulating ? '시뮬레이션 중…' : '시뮬레이션 하기'}
            </PillButton>
          ) : (
            // 구조 오류가 있으면 시뮬레이션을 막는다 (명세 Simulation)
            <PillButton aria-disabled>시뮬레이션 하기</PillButton>
          )}
          {/* 시뮬레이션 통과 기록이 없어 잠김 (명세 Execution) */}
          <PillButton aria-disabled>
            로봇 실행하기<span className="text-[13px]">• 잠김</span>
          </PillButton>
        </div>
      </div>

      {/* 블록 조립 캔버스 (Rectangle 7). */}
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
                  <BlockInput
                    value={program.repeatCount}
                    onChange={onRepeatCountChange}
                    min={REPEAT_RANGE.min}
                    max={REPEAT_RANGE.max}
                    aria-label="반복 횟수"
                  />
                  번 반복하기
                </>
              }
            >
              <Block color="move">
                뒤로{' '}
                <BlockInput
                  value={program.moveDistance}
                  onChange={onMoveDistanceChange}
                  min={MOVE_RANGE.min}
                  max={MOVE_RANGE.max}
                  aria-label="이동 거리 (미터)"
                />{' '}
                m 이동
              </Block>
            </CBlock>
          </li>
          <li>
            <Block color="action">인사하기</Block>
          </li>
          {endConnected && (
            <li>
              <Block color="start" variant="cap">
                종료
              </Block>
            </li>
          )}
        </ol>

        {/* 아직 연결 안 된 '종료' 블록 — 누르면 스택 끝에 붙는다 (Figma Slide 2 Group 11). */}
        {endDetached && (
          <button
            type="button"
            onClick={onConnectBlock}
            aria-label="종료 블록 연결하기"
            className="absolute top-[174px] left-[325px]"
          >
            <Block color="start" variant="cap">
              종료
            </Block>
          </button>
        )}
      </div>
    </section>
  );
}
