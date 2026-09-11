// 시뮬레이션 실행 계약 (기능명세서 Simulation "시뮬레이션 실행" · "안전 제한 검증").
// 백엔드(Poppy-Server)가 확정되면 실제 응답 형태에 맞춰 조정한다.

/**
 * 블록 하나의 직렬화 형태 — 블록별 파라미터(반복 횟수·이동 거리·대기 시간)를 그대로 담는다.
 * 도메인 타입(BlockNode)은 views/experience/model 이 소유하고, 이 타입은 그와 구조만 맞춘
 * 독립된 wire 타입이다(features 는 views 를 참조하지 않는다) — views 쪽 serializeProgram 이 변환한다.
 */
export type SerializedBlockNode =
  | { id: string; kind: 'start' }
  | { id: string; kind: 'greet' }
  | { id: string; kind: 'end' }
  | { id: string; kind: 'move'; distanceM: number }
  | { id: string; kind: 'wait'; seconds: number }
  | { id: string; kind: 'repeat'; count: number; body: SerializedBlockNode[] };

/** 블록 프로그램의 직렬화 형태. */
export type SerializedBlockProgram = {
  /** 시작 블록에 이어진 하나의 체인 */
  chain: SerializedBlockNode[];
  /** 아직 연결되지 않은 자유 블록들 */
  detached: SerializedBlockNode[];
};

export type SimulationRequest = {
  program: SerializedBlockProgram;
};

export type SafetyViolationCode = 'exceeds-safe-zone' | 'invalid-values';

export type SafetyViolation = {
  code: SafetyViolationCode;
  /** 왜 막혔는지 + 어떻게 고칠지 (명세: "수정 가능한 메시지") */
  message: string;
};

export type SimulationResult = {
  /** 블록 구조·안전 제한 검증을 모두 통과했는지 */
  passed: boolean;
  /** 정규화된 명령 수 (명세: "서버는 정규화된 명령과 통과 결과를 발급한다") */
  normalizedCommandCount: number;
  /** 프로그램이 로봇을 움직이는 총 거리 (m) — 반복·합산 포함 */
  totalDistanceM: number;
  /** 안전 제한 위반 목록 (명세 "안전 제한 검증") */
  violations: SafetyViolation[];
  /** 실제 물리 결과와 차이가 있을 수 있음 등 안내 문구 */
  notes: string[];
};
