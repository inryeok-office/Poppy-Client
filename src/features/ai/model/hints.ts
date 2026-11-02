// 규칙 기반 힌트 — 위반 코드별 아이 눈높이 문장. exceeds-safe-zone 은 블록 번호를 짚는다.
// remote 모드가 꺼져 있거나 실패해도 항상 대신할 수 있어야 한다(명세).

import type { AiHint, AiHintRequest } from './types';

const DEFAULT_HINT_MESSAGE =
  '블록을 다시 한 번 살펴봐요. 시작부터 종료까지 순서대로 잘 이어졌는지 확인해 볼까요?';

export function hintFromViolation(request: AiHintRequest): AiHint {
  const code = request.violationCode;
  let message: string;
  switch (code) {
    case 'exceeds-safe-zone':
      message = request.violationBlockNumber
        ? `${request.violationBlockNumber}번째 블록에서 로봇이 안전한 공간 밖으로 나가요. 이동 거리나 방향을 줄여 볼까요?`
        : '로봇이 안전한 공간 밖으로 나가요. 이동 거리나 방향을 줄여 볼까요?';
      break;
    case 'exceeds-time':
      message = '프로그램이 너무 길어서 시간 안에 못 끝나요. 블록 수나 반복 횟수를 줄여 볼까요?';
      break;
    case 'moves-while-sitting':
      message = '로봇이 앉은 채로 움직이려고 해요. 그 앞에 일어서기 블록을 넣어 볼까요?';
      break;
    case 'invalid-values':
      message =
        '블록에 들어간 숫자가 허용 범위를 벗어났어요. 빨간 칸의 숫자를 범위 안으로 바꿔 볼까요?';
      break;
    default:
      message = request.violationMessage ?? DEFAULT_HINT_MESSAGE;
  }
  return { message, source: 'local' };
}
