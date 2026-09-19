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
  | { id: string; kind: 'moveForward'; distanceM: number }
  | { id: string; kind: 'rotateLeft'; degrees: number }
  | { id: string; kind: 'rotateRight'; degrees: number }
  | { id: string; kind: 'stop' }
  | { id: string; kind: 'sit' }
  | { id: string; kind: 'standUp' }
  | { id: string; kind: 'heart' }
  | { id: string; kind: 'dance' }
  | { id: string; kind: 'roll' }
  | { id: string; kind: 'attack' }
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

export type ServerBlock = {
  id: string;
  type: string;
  parameters: Record<string, number | string>;
  children?: ServerBlock[];
};

export type ServerBlockProgram = {
  schemaVersion: 1;
  blocks: ServerBlock[];
};

export function toServerBlockProgram(program: SerializedBlockProgram): ServerBlockProgram {
  const convert = (node: SerializedBlockNode): ServerBlock => {
    switch (node.kind) {
      case 'start':
        return { id: node.id, type: 'START', parameters: {} };
      case 'end':
        return { id: node.id, type: 'END', parameters: {} };
      case 'move':
        return {
          id: node.id,
          type: 'MOVE_FORWARD',
          parameters: { distanceMeters: node.distanceM },
        };
      case 'wait':
        return { id: node.id, type: 'WAIT', parameters: { durationSeconds: node.seconds } };
      case 'repeat':
        return {
          id: node.id,
          type: 'REPEAT',
          parameters: { count: node.count },
          children: node.body.map(convert),
        };
      case 'greet':
        throw new Error('The Server block contract does not support the GREET block');
      case 'moveForward':
      case 'rotateLeft':
      case 'rotateRight':
      case 'stop':
      case 'sit':
      case 'standUp':
      case 'heart':
      case 'dance':
      case 'roll':
      case 'attack':
        throw new Error(
          `The Server block contract does not support the ${node.kind.toUpperCase()} block`,
        );
    }
  };

  if (program.detached.length > 0) {
    throw new Error('Disconnected blocks must be attached before saving to the Server');
  }
  return { schemaVersion: 1, blocks: program.chain.map(convert) };
}

export type SafetyViolationCode = 'exceeds-safe-zone' | 'invalid-values';

export type SafetyViolation = {
  code: SafetyViolationCode;
  /** 왜 막혔는지 + 어떻게 고칠지 (명세: "수정 가능한 메시지") */
  message: string;
};

export type SimulationStepStatus = 'done' | 'failed' | 'pending';

/**
 * 실행순서 한 칸 (Figma Slide 6·7 "실행순서"). repeat 는 실제 반복 횟수만큼 펼쳐진 뒤라
 * 여기엔 나타나지 않고, 펼쳐진 leaf 명령만 순서대로 담긴다.
 */
export type SimulationStep = {
  node: SerializedBlockNode;
  status: SimulationStepStatus;
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
  /** 실행순서 — 구조·값이 유효할 때만 채워진다(그 외엔 빈 배열). */
  steps: SimulationStep[];
};
