import { ApiError } from './axiosInstance';

// Poppy-Server ErrorCode(global/error/ErrorCode.kt) → 체험자에게 보여줄 짧은 한국어 문구.
// 모르는 코드는 진행요원 안내로 통일한다 — 서버의 영어 message 를 그대로 노출하지 않는다.

export const UNKNOWN_ERROR_MESSAGE = '실행 중 문제가 생겼어요. 진행요원에게 알려 주세요.';

const MESSAGES: Record<string, string> = {
  COMMON_400: '요청 값이 올바르지 않아요.',
  BLOCK_PROGRAM_INVALID: '블록 구성이 올바르지 않아요. 블록 값을 확인해 주세요.',
  BLOCK_REVISION_NOT_FOUND: '저장된 블록을 찾지 못했어요. 블록을 다시 저장해 주세요.',
  SESSION_NOT_FOUND: '체험 세션이 끝났어요. 새 세션으로 다시 저장할게요.',
  SESSION_TOKEN_INVALID: '체험 세션이 끝났어요. 새 세션으로 다시 저장할게요.',
  SESSION_EXPIRED: '체험 세션이 끝났어요. 새 세션으로 다시 저장할게요.',
  SIMULATION_BLOCK_VERSION_INVALID: '시뮬레이션을 다시 해 주세요.',
  SIMULATION_BLOCK_VERSION_STALE: '블록이 바뀌었어요. 시뮬레이션을 다시 해 주세요.',
  SIMULATION_PASS_NOT_FOUND: '시뮬레이션을 먼저 통과해 주세요.',
  EXECUTION_SESSION_ACTIVE: '이미 실행 중인 프로그램이 있어요. 끝날 때까지 기다려 주세요.',
  EXECUTION_NOT_FOUND: '실행 정보를 찾지 못했어요. 진행요원에게 알려 주세요.',
  EXECUTION_ACCESS_DENIED: '이 실행을 볼 수 없어요. 진행요원에게 알려 주세요.',
  EXECUTION_CANCELLATION_NOT_ALLOWED: '이미 로봇이 움직이기 시작해 취소할 수 없어요.',
  ROBOT_COMPATIBILITY_NOT_VERIFIED:
    '지금 로봇이 이 블록을 실행할 수 없어요. 진행요원에게 알려 주세요.',
  MISSION_NOT_FOUND: '미션을 찾지 못했어요.',
};

/** 알려진 서버 오류 코드면 한국어 문구, 아니면 진행요원 안내. */
export function describeErrorCode(code: string | undefined | null): string {
  return (code && MESSAGES[code]) || UNKNOWN_ERROR_MESSAGE;
}

/** 임의의 오류(ApiError·네트워크 등)를 체험자용 문구로 바꾼다. */
export function describeError(error: unknown): string {
  return describeErrorCode(error instanceof ApiError ? error.code : undefined);
}
