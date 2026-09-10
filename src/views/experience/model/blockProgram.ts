// 블록 프로그램 모델 (기능명세서 Mission & Block · Simulation).
//
//   stack     — 시작 블록에서 이어진 블록 트리. start 는 항상 맨 앞이고 드래그·삭제할 수 없다.
//   detached  — 캔버스에 떨어져 아직 연결되지 않은 블록 (Figma Slide 2 의 '종료').
// '번 반복하기'(repeat) 는 body 를 갖는 C블록 — v1 은 body 를 '뒤로 m 이동' 하나로 프리필한
// 상태로 고정한다(중첩 드롭 편집은 후속 조각). 재정렬·삭제는 repeat 블록을 통째로 움직인다.
//
// 서버·시뮬레이션·자동 저장은 여전히 flat 한 SerializedBlockProgram 을 받는다 → serializeProgram.

import type { SerializedBlockProgram } from '@/features/simulation';

export type BlockKind = 'start' | 'repeat' | 'move' | 'greet' | 'wait' | 'end';

export const REPEAT_RANGE = { min: 1, max: 20 } as const;
export const MOVE_RANGE = { min: 1, max: 10 } as const;
export const WAIT_RANGE = { min: 1, max: 60 } as const;

export type BlockNode =
  | { id: string; kind: 'start' }
  | { id: string; kind: 'greet' }
  | { id: string; kind: 'end' }
  | { id: string; kind: 'move'; distanceM: number }
  | { id: string; kind: 'wait'; seconds: number }
  | { id: string; kind: 'repeat'; count: number; body: BlockNode[] };

export type BlockProgram = {
  /** 시작 블록에서 이어진 블록 순서 (stack[0] 은 항상 start) */
  stack: BlockNode[];
  /** 아직 연결되지 않고 캔버스에 떨어져 있는 블록 */
  detached: BlockNode[];
};

// ── 블록 생성 ──────────────────────────────────────────────────────────────────

let idSeq = 0;
/** 팔레트에서 새로 꺼낸 블록의 안정적인 id. 트리 어디서든 유일하면 된다. */
function nextId(prefix: BlockKind): string {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}

/** 팔레트 → 캔버스로 새 블록을 만든다. 파라미터는 허용 범위 최소값으로 시작. */
export function newBlock(kind: BlockKind): BlockNode {
  switch (kind) {
    case 'move':
      return { id: nextId('move'), kind, distanceM: MOVE_RANGE.min };
    case 'wait':
      return { id: nextId('wait'), kind, seconds: WAIT_RANGE.min };
    case 'repeat':
      return {
        id: nextId('repeat'),
        kind,
        count: 2,
        body: [{ id: nextId('move'), kind: 'move', distanceM: MOVE_RANGE.min }],
      };
    default:
      return { id: nextId(kind), kind } as BlockNode;
  }
}

/** Figma Slide 2 상태 — '종료' 블록이 스택 밖에 떨어져 있다. */
export const INITIAL_PROGRAM: BlockProgram = {
  stack: [
    { id: 'start-0', kind: 'start' },
    {
      id: 'repeat-0',
      kind: 'repeat',
      count: 2,
      body: [{ id: 'move-0', kind: 'move', distanceM: 1 }],
    },
    { id: 'greet-0', kind: 'greet' },
  ],
  detached: [{ id: 'end-0', kind: 'end' }],
};

// ── 순수 편집 연산 (드래그 삽입·재정렬·삭제 · 클릭 연결 · 값 편집) ────────────────

/** 스택의 atIndex 위치에 블록을 끼운다. start(0) 앞에는 못 넣는다. 같은 id 의 떨어진 블록은 정리. */
export function insertBlock(program: BlockProgram, node: BlockNode, atIndex: number): BlockProgram {
  const at = Math.max(1, Math.min(program.stack.length, atIndex));
  const stack = [...program.stack];
  stack.splice(at, 0, node);
  return { stack, detached: program.detached.filter((d) => d.id !== node.id) };
}

/** 스택 안에서 블록을 toIndex 위치로 옮긴다. start 는 못 옮긴다. */
export function moveBlock(program: BlockProgram, id: string, toIndex: number): BlockProgram {
  const from = program.stack.findIndex((n) => n.id === id);
  if (from <= 0) return program;

  const rest = program.stack.filter((_, i) => i !== from);
  // toIndex 는 "이동 전" 스택 기준 슬롯이므로, 뒤로 가는 경우 제거분만큼 당긴다.
  const to = Math.max(1, Math.min(rest.length, from < toIndex ? toIndex - 1 : toIndex));
  rest.splice(to, 0, program.stack[from]);
  return { ...program, stack: rest };
}

/** 블록을 프로그램에서 완전히 제거한다 (스택·떨어진 목록 모두). start 는 못 지운다. */
export function removeBlock(program: BlockProgram, id: string): BlockProgram {
  if (program.stack[0]?.id === id) return program;
  return {
    stack: program.stack.filter((n) => n.id !== id),
    detached: program.detached.filter((n) => n.id !== id),
  };
}

/** 떨어진 블록을 스택 끝으로 연결한다 (드래그의 키보드/클릭 대체 수단). */
export function connectDetachedBlocks(program: BlockProgram): BlockProgram {
  if (program.detached.length === 0) return program;
  return { stack: [...program.stack, ...program.detached], detached: [] };
}

type BlockParamPatch = { count?: number; distanceM?: number; seconds?: number };

/** 특정 블록의 파라미터(반복 횟수·이동 거리 등)만 바꾼다. 트리 어디에 있든 찾는다. */
export function setBlockParam(
  program: BlockProgram,
  id: string,
  patch: BlockParamPatch,
): BlockProgram {
  const map = (nodes: BlockNode[]): BlockNode[] =>
    nodes.map((node) => {
      const next = node.id === id ? ({ ...node, ...patch } as BlockNode) : node;
      return next.kind === 'repeat' ? { ...next, body: map(next.body) } : next;
    });
  return { stack: map(program.stack), detached: map(program.detached) };
}

// ── 직렬화 (서버·시뮬레이션·자동 저장 계약은 flat 형태 유지) ────────────────────

function flattenKinds(nodes: BlockNode[]): BlockKind[] {
  const out: BlockKind[] = [];
  for (const node of nodes) {
    out.push(node.kind);
    if (node.kind === 'repeat') out.push(...flattenKinds(node.body));
  }
  return out;
}

function firstRepeatCount(nodes: BlockNode[]): number | undefined {
  for (const node of nodes) {
    if (node.kind === 'repeat') return node.count;
  }
  return undefined;
}

function firstMoveDistance(nodes: BlockNode[]): number | undefined {
  for (const node of nodes) {
    if (node.kind === 'move') return node.distanceM;
    if (node.kind === 'repeat') {
      const nested = firstMoveDistance(node.body);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
}

/** 블록 트리를 서버가 받는 flat 프로그램으로 변환한다 (features/simulation 계약). */
export function serializeProgram(program: BlockProgram): SerializedBlockProgram {
  return {
    chain: flattenKinds(program.stack),
    detached: flattenKinds(program.detached),
    repeatCount: firstRepeatCount(program.stack) ?? REPEAT_RANGE.min,
    moveDistance: firstMoveDistance(program.stack) ?? MOVE_RANGE.min,
  };
}

// ── 초안(localStorage) 복원 ───────────────────────────────────────────────────

function isBlockNode(value: unknown): value is BlockNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  return typeof node.id === 'string' && typeof node.kind === 'string';
}

/** 자동 저장이 남긴 트리 스냅샷인지 확인한다. */
export function isBlockProgramSnapshot(value: unknown): value is BlockProgram {
  if (typeof value !== 'object' || value === null) return false;
  const snap = value as Record<string, unknown>;
  return (
    Array.isArray(snap.stack) &&
    Array.isArray(snap.detached) &&
    snap.stack.every(isBlockNode) &&
    snap.detached.every(isBlockNode) &&
    (snap.stack[0] as BlockNode | undefined)?.kind === 'start'
  );
}

/**
 * 저장된 스냅샷을 프로그램으로 되돌린다.
 * 트리 스냅샷이면 그대로, 아니면(구버전 flat 초안 등) 초기 프로그램으로 시작한다.
 */
export function draftToProgram(snapshot: unknown): BlockProgram {
  return isBlockProgramSnapshot(snapshot)
    ? { stack: snapshot.stack, detached: snapshot.detached }
    : INITIAL_PROGRAM;
}

// ── 검증 · 이동 거리 ──────────────────────────────────────────────────────────

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

  if (program.detached.some((node) => node.kind !== 'end')) {
    errors.push({
      code: 'disconnected-block',
      message: '연결되지 않은 블록이 있어요. 모든 블록을 시작 블록에 이어 주세요.',
    });
  }
  if (program.stack.at(-1)?.kind !== 'end') {
    errors.push({
      code: 'missing-end',
      message: '‘종료’ 블록을 연결해 프로그램을 끝내 주세요.',
    });
  }

  return errors;
}

/** 프로그램이 로봇을 움직이는 총 거리 (m). 명세: "제한을 우회하는 중첩·합산 값도 계산". */
export function totalTravelDistance(program: BlockProgram): number {
  const walk = (nodes: BlockNode[], multiplier: number): number => {
    let sum = 0;
    for (const node of nodes) {
      if (node.kind === 'move') sum += node.distanceM * multiplier;
      else if (node.kind === 'repeat') sum += walk(node.body, multiplier * node.count);
    }
    return sum;
  };
  return walk(program.stack, 1);
}

/** 직렬화된 명령 수 (로봇 미리보기 "블록 N개"). */
export function blockCommandCount(program: BlockProgram): number {
  return flattenKinds(program.stack).length;
}
