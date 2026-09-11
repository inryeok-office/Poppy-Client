// 블록 프로그램 모델 (기능명세서 Mission & Block · Simulation).
//
//   stack     — 시작 블록에 이어진 하나의 체인 (stack[0] 은 항상 start). 서버로 보내는 프로그램.
//   floating  — 캔버스에 자유 배치된, 아직 연결되지 않은 블록 체인들 (Figma Slide 2 의 '종료').
//
// 드래그 동작 (기명서 "블록 드래그 이동·스냅 연결"):
//   · 블록을 잡으면 그 아래에 연결된 블록이 함께 딸려온다 (carriedBlocks).
//   · 연결 가능한 지점(스택 슬롯)에 가까우면 스냅 미리보기 → 스냅 거리 안에서 놓으면 연결 (dropOnSlot).
//   · 스냅 거리 밖에서 놓으면 연결하지 않고 놓은 자리에 둔다 (dropOnCanvas — floating 그룹).
//   · '번 반복하기'(repeat) body 는 '뒤로 m 이동' 하나로 프리필 고정 (중첩 편집은 후속).
//
// 서버·시뮬레이션·자동 저장은 블록별 파라미터를 그대로 보존한 SerializedBlockProgram 을 받는다
// (블록마다 다른 반복 횟수·이동 거리·대기 시간을 가질 수 있어 첫 값만 뽑아 보내면 안 된다) → serializeProgram.

import type { SerializedBlockNode, SerializedBlockProgram } from '@/features/simulation';

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

/** 캔버스에 자유 배치된, 연결 안 된 블록 체인 */
export type FloatingGroup = {
  id: string;
  /** 캔버스 좌상단 기준 좌표 (px) */
  x: number;
  y: number;
  /** 위→아래로 이어진 블록들 */
  blocks: BlockNode[];
};

export type BlockProgram = {
  /** 시작 블록에 이어진 하나의 체인 (stack[0] = start) */
  stack: BlockNode[];
  /** 아직 연결되지 않고 캔버스에 놓여 있는 블록 그룹들 */
  floating: FloatingGroup[];
};

// ── 블록 생성 ──────────────────────────────────────────────────────────────────

// 세션마다 다른 접두어(로드 시각)를 붙여, 초안을 복원한 뒤 새로 만드는 블록이 복원된
// 블록과 같은 id 를 받지 않게 한다(카운터는 0부터 다시 시작하지만 접두어가 세션마다 다르다).
const SESSION_ID_PREFIX = Date.now().toString(36);
let idSeq = 0;
function nextId(prefix: string): string {
  idSeq += 1;
  return `${prefix}-${SESSION_ID_PREFIX}-${idSeq}`;
}

/** 팔레트 → 캔버스로 새 블록을 만든다. 파라미터는 허용 범위 최소값으로 시작. */
export function newBlock(kind: BlockKind): BlockNode {
  switch (kind) {
    case 'move':
      return { id: nextId('move'), kind, distanceM: MOVE_RANGE.min };
    case 'wait':
      return { id: nextId('wait'), kind, seconds: WAIT_RANGE.min };
    case 'repeat':
      // 팔레트에서 갓 꺼낸 반복 블록은 body 가 비어 있다 (팔레트에 보이는 모습 그대로).
      return { id: nextId('repeat'), kind, count: 2, body: [] };
    default:
      return { id: nextId(kind), kind } as BlockNode;
  }
}

/** Figma Slide 2 상태 — '종료' 블록이 스택 밖(캔버스 x325 y174)에 놓여 있다. */
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
  floating: [{ id: 'float-end-0', x: 325, y: 174, blocks: [{ id: 'end-0', kind: 'end' }] }],
};

// ── 드래그로 집은 블록 체인 ────────────────────────────────────────────────────

/** 드래그를 시작한 블록 (팔레트는 새 노드, 나머지는 캔버스에 있는 노드). */
export type DragPick =
  | { origin: 'palette'; node: BlockNode }
  | { origin: 'stack'; nodeId: string }
  | { origin: 'floating'; nodeId: string };

function stackIndexOf(stack: BlockNode[], id: string): number {
  return stack.findIndex((n) => n.id === id);
}

function groupOf(floating: FloatingGroup[], id: string): FloatingGroup | undefined {
  return floating.find((g) => g.blocks.some((b) => b.id === id));
}

/** 잡은 블록 + 그 아래 연결된 블록들 (기명서: "아래에 연결된 블록은 함께 이동한다"). */
export function carriedBlocks(program: BlockProgram, pick: DragPick): BlockNode[] {
  if (pick.origin === 'palette') return [pick.node];
  if (pick.origin === 'stack') {
    const i = stackIndexOf(program.stack, pick.nodeId);
    return i <= 0 ? [] : program.stack.slice(i); // start(0) 는 못 집는다
  }
  const group = groupOf(program.floating, pick.nodeId);
  if (!group) return [];
  const j = group.blocks.findIndex((b) => b.id === pick.nodeId);
  return group.blocks.slice(j);
}

/** 집은 블록들을 원래 자리에서 떼어낸다. (스택은 잘라내고, 그룹은 나머지만 남긴다.) */
function detachCarried(program: BlockProgram, pick: DragPick): BlockProgram {
  if (pick.origin === 'palette') return program;
  if (pick.origin === 'stack') {
    const i = stackIndexOf(program.stack, pick.nodeId);
    if (i <= 0) return program;
    return { ...program, stack: program.stack.slice(0, i) };
  }
  const group = groupOf(program.floating, pick.nodeId);
  if (!group) return program;
  const j = group.blocks.findIndex((b) => b.id === pick.nodeId);
  const remaining = group.blocks.slice(0, j);
  const floating =
    remaining.length > 0
      ? program.floating.map((g) => (g.id === group.id ? { ...g, blocks: remaining } : g))
      : program.floating.filter((g) => g.id !== group.id);
  return { ...program, floating };
}

/** 스냅 거리 안에서 놓았다 — 집은 체인을 스택 slotIndex 위치에 연결한다. */
export function dropOnSlot(program: BlockProgram, pick: DragPick, slotIndex: number): BlockProgram {
  const carried = carriedBlocks(program, pick);
  if (carried.length === 0) return program;

  const base = detachCarried(program, pick);
  const at = Math.max(1, Math.min(base.stack.length, slotIndex));
  const stack = [...base.stack.slice(0, at), ...carried, ...base.stack.slice(at)];
  return { ...base, stack };
}

/** 스냅 거리 밖에서 놓았다 — 집은 체인을 연결 없이 캔버스 (x, y) 에 둔다. */
export function dropOnCanvas(
  program: BlockProgram,
  pick: DragPick,
  x: number,
  y: number,
): BlockProgram {
  const carried = carriedBlocks(program, pick);
  if (carried.length === 0) return program;

  // 이미 자유 그룹의 맨 앞 블록을 통째로 옮기는 경우엔 그룹 좌표만 갱신
  if (pick.origin === 'floating') {
    const group = groupOf(program.floating, pick.nodeId);
    if (group && group.blocks[0]?.id === pick.nodeId) {
      return {
        ...program,
        floating: program.floating.map((g) => (g.id === group.id ? { ...g, x, y } : g)),
      };
    }
  }

  const base = detachCarried(program, pick);
  return {
    ...base,
    floating: [...base.floating, { id: nextId('float'), x, y, blocks: carried }],
  };
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
  return {
    stack: map(program.stack),
    floating: program.floating.map((g) => ({ ...g, blocks: map(g.blocks) })),
  };
}

// ── 직렬화 (서버·시뮬레이션·자동 저장 계약 — 블록별 파라미터를 그대로 보존한다) ──

function serializeNode(node: BlockNode): SerializedBlockNode {
  if (node.kind === 'repeat') {
    return { id: node.id, kind: 'repeat', count: node.count, body: node.body.map(serializeNode) };
  }
  return node;
}

/**
 * 블록 트리를 서버가 받는 프로그램으로 변환한다 (features/simulation 계약).
 * 블록마다 다른 반복 횟수·이동 거리·대기 시간을 가질 수 있어, 첫 값만 뽑지 않고
 * 노드 하나하나를 그대로 옮긴다 — 그래야 화면에서 만든 프로그램과 실제 시뮬레이션이 같다.
 */
export function serializeProgram(program: BlockProgram): SerializedBlockProgram {
  return {
    chain: program.stack.map(serializeNode),
    detached: program.floating.flatMap((g) => g.blocks).map(serializeNode),
  };
}

// ── 초안(localStorage) 복원 ───────────────────────────────────────────────────

const BLOCK_KINDS: readonly BlockKind[] = ['start', 'repeat', 'move', 'greet', 'wait', 'end'];

/** 블록 종류별 필수 필드까지 확인한다 — 손상된 스냅샷을 그대로 렌더하면 화면이 죽는다. */
function isBlockNode(value: unknown): value is BlockNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  if (typeof node.id !== 'string' || typeof node.kind !== 'string') return false;
  if (!BLOCK_KINDS.includes(node.kind as BlockKind)) return false;

  switch (node.kind as BlockKind) {
    case 'move':
      return typeof node.distanceM === 'number';
    case 'wait':
      return typeof node.seconds === 'number';
    case 'repeat':
      return (
        typeof node.count === 'number' && Array.isArray(node.body) && node.body.every(isBlockNode)
      );
    default:
      return true; // start · greet · end 는 추가 필드가 없다
  }
}

function isFloatingGroup(value: unknown): value is FloatingGroup {
  if (typeof value !== 'object' || value === null) return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.id === 'string' &&
    typeof g.x === 'number' &&
    typeof g.y === 'number' &&
    Array.isArray(g.blocks) &&
    g.blocks.every(isBlockNode)
  );
}

/** stack·floating 을 통틀어(반복 body 안까지) 특정 종류가 몇 번 나오는지. */
function countKind(nodes: BlockNode[], kind: BlockKind): number {
  return nodes.reduce(
    (sum, node) =>
      sum +
      (node.kind === kind ? 1 : 0) +
      (node.kind === 'repeat' ? countKind(node.body, kind) : 0),
    0,
  );
}

/**
 * 자동 저장이 남긴 프로그램 스냅샷인지 확인한다.
 * 노드 모양뿐 아니라 구조 불변식도 지킨다 — start 는 정확히 하나이고 스택 맨 앞에만,
 * end 는 많아야 하나(스택 끝이거나 자유 블록으로) — 그래야 복원 직후 화면이 깨지지 않는다.
 */
export function isBlockProgramSnapshot(value: unknown): value is BlockProgram {
  if (typeof value !== 'object' || value === null) return false;
  const snap = value as Record<string, unknown>;
  if (!Array.isArray(snap.stack) || !Array.isArray(snap.floating)) return false;
  if (!snap.stack.every(isBlockNode) || !snap.floating.every(isFloatingGroup)) return false;

  const stack = snap.stack as BlockNode[];
  const floating = snap.floating as FloatingGroup[];
  const allNodes = [...stack, ...floating.flatMap((g) => g.blocks)];

  if (stack[0]?.kind !== 'start') return false;
  if (countKind(allNodes, 'start') !== 1) return false;
  if (countKind(allNodes, 'end') > 1) return false;

  return true;
}

/**
 * 저장된 스냅샷을 프로그램으로 되돌린다.
 * 프로그램 스냅샷이면 그대로, 아니면(구버전 초안 등) 초기 프로그램으로 시작한다.
 */
export function draftToProgram(snapshot: unknown): BlockProgram {
  return isBlockProgramSnapshot(snapshot)
    ? { stack: snapshot.stack, floating: snapshot.floating }
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
  const floatingKinds = program.floating.flatMap((g) => g.blocks.map((b) => b.kind));

  if (floatingKinds.some((kind) => kind !== 'end')) {
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
