import type { SimulationResult, SimulationStepStatus } from '@/features/simulation';

import { describeBlock } from '../model/blockProgram';

// Figma "뽀삐" node 34:1350(Slide 6, 실패) / 47:1733(Slide 7, 성공) — 시뮬레이션 결과 카드 +
// 실행순서. 실행 버튼은 담지 않는다 — BlockWorkspace/RunReadyWorkspace 가 이미 갖고 있는
// '시뮬레이션 하기'·'로봇 실행하기' 버튼과 같은 이름으로 중복되면 접근성 이름이 겹친다.
// 대신 이 컴포넌트는 두 화면에 끼워 넣는 순수 정보 표시용이다.

const STATUS_LABEL: Record<SimulationStepStatus, string> = {
  done: '완료',
  failed: '문제 발생',
  pending: '대기',
};

// done·failed 는 기존 Block 컴포넌트와 같은 방식(색 배경 + 흰 글자) — 이미 대비를 맞춰 쓰던
// 조합이다. pending 은 흰 글자를 얹지 않고 외곽선만 그린다 — muted 배경에 흰 숫자를 얹으면
// 대비가 2.7:1로 부족해진다(코드리뷰에서 success 에 지적된 것과 같은 문제라 미리 피한다).
const STATUS_BADGE: Record<SimulationStepStatus, string> = {
  done: 'bg-block-start text-white',
  failed: 'bg-danger text-white',
  pending: 'border border-muted text-muted',
};

type SimulationResultSummaryProps = {
  result: SimulationResult;
};

export function SimulationResultSummary({ result }: SimulationResultSummaryProps) {
  const passed = result.passed;
  const message = passed
    ? '안전 범위 안에서 잘 움직였어요. 이제 실제 로봇으로 실행할 수 있어요.'
    : (result.violations[0]?.message ?? '블록을 다시 확인해 주세요.');

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`flex flex-col gap-2 rounded-xl border p-4 ${
          passed ? 'bg-success-bg border-success' : 'bg-danger-bg border-danger'
        }`}
      >
        <div className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[14px] text-white ${
              passed ? 'bg-success' : 'bg-danger'
            }`}
          >
            {passed ? '✓' : '!'}
          </span>
          <p className={`text-[16px] ${passed ? 'text-success' : 'text-danger'}`}>
            {passed ? '시뮬레이션 통과!' : '조금만 고치면 돼요!'}
          </p>
        </div>
        <p className="text-ink text-[15px]">{message}</p>
      </div>

      {result.steps.length > 0 && (
        <ol className="flex flex-col gap-3" aria-label="실행순서">
          {result.steps.map((step, index) => (
            <li key={index} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[13px] ${STATUS_BADGE[step.status]}`}
                >
                  {index + 1}
                </span>
                <span
                  className={`text-[15px] ${step.status === 'failed' ? 'text-danger' : 'text-ink'}`}
                >
                  {describeBlock(step.node)}
                </span>
              </span>
              <span
                className={`text-[14px] ${step.status === 'failed' ? 'text-danger' : 'text-muted'}`}
              >
                {STATUS_LABEL[step.status]}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
