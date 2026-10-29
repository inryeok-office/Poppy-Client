import type { MissionResult } from '@/features/execution';

// Server BlockType → 화면 블록 이름 (미션 판정 사유 문구용).
const BLOCK_LABEL: Record<string, string> = {
  WAIT: '기다리기',
  REPEAT: '반복',
  MOVE_FORWARD: '앞으로 이동',
  MOVE_BACKWARD: '이동',
  TURN_LEFT: '왼쪽 회전',
  TURN_RIGHT: '오른쪽 회전',
  STOP: '정지',
  SIT: '앉기',
  STAND: '일어서기',
  PRESET: '특수 동작',
};

// 'TURN_LEFT|TURN_RIGHT' → '왼쪽 회전 또는 오른쪽 회전'
function blocks(detail: string): string {
  return detail
    .split('|')
    .map((type) => BLOCK_LABEL[type] ?? type)
    .join(' 또는 ');
}

/** Server 판정 사유(code·detail) → 체험자 문구. 모르는 code 는 일반 문구. */
export function missionReasonText(reason: { code: string; detail: string }): string {
  switch (reason.code) {
    case 'MISSING_REQUIRED_BLOCK':
      return `‘${blocks(reason.detail)}’ 블록이 필요해요.`;
    case 'FORBIDDEN_BLOCK':
      return `이 미션에서는 ‘${blocks(reason.detail)}’ 블록을 쓰지 않아요.`;
    case 'ORDER_NOT_SATISFIED':
      return `순서를 확인해요: ${reason.detail.split(' -> ').map(blocks).join(' → ')}`;
    case 'TOO_FEW_EXECUTIONS': {
      const [types, count] = reason.detail.split(' x');
      return `‘${blocks(types ?? '')}’을(를) ${count ?? ''}번 이상 해야 해요.`;
    }
    case 'LAST_ACTION_MISMATCH':
      return `마지막은 ‘${blocks(reason.detail)}’ 블록으로 끝내요.`;
    case 'TOO_MANY_BLOCKS':
      return '블록 수를 조금 줄여 봐요.';
    default:
      return '미션 조건을 다시 확인해 봐요.';
  }
}

// 미션 실행 완료 후 Server 판정 카드 (블록 구성 기준 — 실제 위치는 진행요원이 확인).
export function MissionResultCard({ result }: { result: MissionResult }) {
  if (result.passed) {
    return (
      <section
        aria-label="미션 결과"
        data-testid="mission-result"
        data-passed="true"
        className="border-success bg-success-bg text-success rounded-[12px] border-[1.5px] px-4 py-3 text-[14px]"
      >
        미션 성공! 블록을 미션 조건에 맞게 잘 짰어요.
      </section>
    );
  }
  return (
    <section
      aria-label="미션 결과"
      data-testid="mission-result"
      data-passed="false"
      className="border-danger bg-danger-bg text-danger rounded-[12px] border-[1.5px] px-4 py-3 text-[14px]"
    >
      <p className="font-semibold">아쉬워요! 미션 조건이 조금 부족해요.</p>
      <ul className="mt-1 list-disc pl-5">
        {result.reasons.map((reason) => (
          <li key={`${reason.code}-${reason.detail}`}>{missionReasonText(reason)}</li>
        ))}
      </ul>
    </section>
  );
}
