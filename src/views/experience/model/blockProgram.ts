// 블록 프로그램 모델 (기능명세서 Mission & Block · Simulation).
//
// 지금은 고정 데모 프로그램의 두 상태만 표현한다:
//   - 초기: '종료' 블록이 스택에서 떨어져 있음 (Figma Slide 2)
//   - 연결 후: 시작~종료가 하나로 이어진 완성 프로그램 (Figma Slide 3)
// 팔레트 드래그앤드롭 전체 편집(추가·삭제·재배치)은 후속 조각.

export type BlockKind = 'start' | 'repeat' | 'move' | 'greet' | 'end';

export type BlockProgram = {
  /** 시작 블록에서 이어진 블록 순서 */
  chain: BlockKind[];
  /** 아직 연결되지 않고 캔버스에 떨어져 있는 블록 */
  detached: BlockKind[];
};

/** Figma Slide 2 상태 — '종료' 블록이 스택 밖에 떨어져 있다. */
export const INITIAL_PROGRAM: BlockProgram = {
  chain: ['start', 'repeat', 'move', 'greet'],
  detached: ['end'],
};

export type BlockErrorCode = 'disconnected-block' | 'missing-end';

export type BlockError = {
  code: BlockErrorCode;
  message: string;
};

/**
 * 블록 구조 검증 (명세 Simulation "블록 구조 검증").
 * 연결되지 않은 블록과 '종료' 미연결을 찾는다.
 * 오류가 하나라도 있으면 시뮬레이션·실제 실행을 막아야 한다.
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
  return { chain: [...program.chain, ...program.detached], detached: [] };
}
