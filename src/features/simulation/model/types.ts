// 시뮬레이션 실행 계약 (기능명세서 Simulation "시뮬레이션 실행").
// 백엔드(Poppy-Server)가 확정되면 실제 응답 형태에 맞춰 조정한다.

/** 블록 프로그램의 직렬화 형태. 도메인 타입은 views/experience/model 이 소유한다. */
export type SerializedBlockProgram = {
  chain: string[];
  detached: string[];
};

export type SimulationRequest = {
  program: SerializedBlockProgram;
};

export type SimulationResult = {
  /** 블록 구조·안전 제한 검증을 모두 통과했는지 */
  passed: boolean;
  /** 정규화된 명령 수 (명세: "서버는 정규화된 명령과 통과 결과를 발급한다") */
  normalizedCommandCount: number;
  /** 실제 물리 결과와 차이가 있을 수 있음 등 안내 문구 (명세) */
  notes: string[];
};
