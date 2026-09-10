// 블록 프로그램 모델 (기능명세서 Mission & Block · Simulation).
//
// 지금은 고정 데모 프로그램(시작 → 반복{뒤로 m 이동} → 인사하기 → 종료)을 표현한다.
//   - chain / detached: '종료' 연결 여부 (Figma Slide 2 ↔ 3)
//   - repeatCount / moveDistance: 반복·이동 블록 값 (편집 가능)
// 팔레트 드래그앤드롭 전체 편집(추가·삭제·재배치)은 후속 조각.

export type BlockKind = 'start' | 'repeat' | 'move' | 'greet' | 'end';

export const REPEAT_RANGE = { min: 1, max: 20 } as const;
export const MOVE_RANGE = { min: 1, max: 10 } as const;

export type BlockProgram = {
  /** 시작 블록에서 이어진 블록 순서 */
  chain: BlockKind[];
  /** 아직 연결되지 않고 캔버스에 떨어져 있는 블록 */
  detached: BlockKind[];
  /** '번 반복하기' 블록 횟수 */
  repeatCount: number;
  /** '뒤로 m 이동' 블록 거리 (m) */
  moveDistance: number;
};

/** Figma Slide 2 상태 — '종료' 블록이 스택 밖에 떨어져 있다. */
export const INITIAL_PROGRAM: BlockProgram = {
  chain: ['start', 'repeat', 'move', 'greet'],
  detached: ['end'],
  repeatCount: 2,
  moveDistance: 1,
};

/** 프로그램이 로봇을 움직이는 총 거리 (m). 명세: "제한을 우회하는 중첩·합산 값도 계산". */
export function totalTravelDistance(program: BlockProgram): number {
  return program.repeatCount * program.moveDistance;
}

export type BlockErrorCode = 'disconnected-block' | 'missing-end';

export type BlockError = {
  code: BlockErrorCode;
  message: string;
};

/**
 * 블록 구조 검증 (명세 Simulation "블록 구조 검증").
 * 연결되지 않은 블록과 '종료' 미연결을 찾는다.
 * 오류가 하나라도 있으면 시뮬레이션·실제 실행을 막아야 한다.
 * (속도·거리 등 안전 제한은 서버가 검증한다 — features/simulation)
 */
export function validateBlockProgram(program: BlockProgram): BlockError[] {
  const errors: BlockError[] = [];

  if (program.detached.some((kind) => kind !== 'end')) {
    errors.push({
      code: 'disconnected-block',
      message: '연결되지 않은 블록이 있어요. 모든 블록을 시작 블록에 이어 주세요.',
    });
  }
  if (program.chain.at(-1) !== 'end') {
    errors.push({
      code: 'missing-end',
      message: '‘종료’ 블록을 연결해 프로그램을 끝내 주세요.',
    });
  }

  return errors;
}

/** 떨어진 블록을 스택 끝으로 연결한다 (임시 편집 — 클릭 연결). */
export function connectDetachedBlocks(program: BlockProgram): BlockProgram {
  if (program.detached.length === 0) return program;
  return { ...program, chain: [...program.chain, ...program.detached], detached: [] };
}
