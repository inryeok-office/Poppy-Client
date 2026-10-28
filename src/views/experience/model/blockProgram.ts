// 블록 프로그램 모델 (기능명세서 Mission & Block · Simulation).
//
//   stack     — 시작 → 실행 블록들 → 종료. 시작(stack[0])·종료(stack 끝)는 캔버스에 고정된
//               Entry 라 지우거나 옮길 수 없다. 서버로 보내는 프로그램.
//   floating  — 캔버스에 자유 배치된, 아직 연결되지 않은 실행 블록 체인들.
//
// 드래그 동작 (기명서 "블록 드래그 이동·스냅 연결"):
//   · 블록을 잡으면 같은 목록에서 그 아래 연결된 블록이 함께 딸려온다 (carriedBlocks).
//     반복 블록을 잡으면 입(body) 안 블록도 함께 움직인다.
//   · 연결 가능한 지점(스택 슬롯·반복 입 슬롯)에 가까우면 스냅 미리보기 → 놓으면 연결 (dropOnSlot).
//   · 반복 안에 반복은 넣을 수 없다 (canNestInRepeat). 빈 반복은 오류로 표시한다.
//   · 스냅 거리 밖에서 놓으면 연결하지 않고 놓은 자리에 둔다 (dropOnCanvas — floating 그룹).
//
// 서버·시뮬레이션·자동 저장은 블록별 파라미터를 그대로 보존한 SerializedBlockProgram 을 받는다
// (블록마다 다른 반복 횟수·이동 거리·대기 시간을 가질 수 있어 첫 값만 뽑아 보내면 안 된다) → serializeProgram.

import { LIMITS } from '@/features/simulation';
import type { SerializedBlockNode, SerializedBlockProgram } from '@/features/simulation';
import { sumOverBlockTree } from '@/shared/lib/blockTree';

export type BlockKind =
  | 'start'
  | 'repeat'
  | 'move'
  | 'moveForward'
  | 'rotateLeft'
  | 'rotateRight'
  | 'stop'
  | 'greet'
  | 'sit'
  | 'standUp'
  | 'heart'
  | 'dance'
  | 'roll'
  | 'attack'
  | 'wait'
  | 'end';

// 서버(features/simulation LIMITS)와 같은 값을 그대로 가져다 쓴다 — 입력칸 min·max 가
// 서버 허용 범위와 따로 놀다 어긋나는 걸 막는다.
export const REPEAT_RANGE = LIMITS.repeatCount;
export const MOVE_RANGE = LIMITS.moveDistance;
export const WAIT_RANGE = LIMITS.waitSeconds;
export const ROTATE_RANGE = LIMITS.rotateDegree;

// 팔레트에서 꺼낸 블록의 기본값 (Notion "블록 타입 및 파라미터 정의" 예시값).
export const DEFAULT_MOVE_M = 0.5;
export const DEFAULT_ROTATE_DEG = 90;
export const DEFAULT_REPEAT_COUNT = 4;

export type BlockNode =
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

// crypto.randomUUID() — 초안을 복원한 뒤 새로 만드는 블록이 복원된 블록과 같은 id 를
// 받을 걱정이 없다 (session·execution mock 도 이미 같은 방식으로 id 를 만든다).
function nextId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** 팔레트 → 캔버스로 새 블록을 만든다. 파라미터는 허용 범위 최소값으로 시작. */
export function newBlock(kind: BlockKind): BlockNode {
  switch (kind) {
    case 'move':
    case 'moveForward':
      return { id: nextId(kind), kind, distanceM: DEFAULT_MOVE_M };
    case 'rotateLeft':
    case 'rotateRight':
      return { id: nextId(kind), kind, degrees: DEFAULT_ROTATE_DEG };
    case 'wait':
      return { id: nextId('wait'), kind, seconds: WAIT_RANGE.min };
    case 'repeat':
      // 팔레트에서 갓 꺼낸 반복 블록은 body 가 비어 있다 (팔레트에 보이는 모습 그대로).
      return { id: nextId('repeat'), kind, count: DEFAULT_REPEAT_COUNT, body: [] };
    default:
      return { id: nextId(kind), kind } as BlockNode;
  }
}

/**
 * 처음 화면 — 캔버스에 고정된 시작·종료 Entry 만 있고, 실행 블록은 그 사이(빈 자리)에 끼운다
 * (Notion "블록 편집기 인터랙션 명세"). 시작·종료는 지우거나 복제할 수 없다.
 */
export const INITIAL_PROGRAM: BlockProgram = {
  stack: [
    { id: 'start-0', kind: 'start' },
    { id: 'end-0', kind: 'end' },
  ],
  floating: [],
};

// ── 드래그로 집은 블록 체인 ────────────────────────────────────────────────────
//
// 시작·종료는 캔버스에 고정된 Entry 라 집을 수 없다. 실행 블록은 둘 사이(스택) 또는 반복 블록의
// 입(body) 안에만 놓인다. 반복 안에 반복은 넣을 수 없다(중첩 금지).

/** 드래그를 시작한 블록 (팔레트는 새 노드, 나머지는 캔버스에 있는 노드). */
export type DragPick =
  | { origin: 'palette'; node: BlockNode }
  | { origin: 'stack'; nodeId: string }
  | { origin: 'floating'; nodeId: string };

/** 스냅으로 끼울 자리 — parentId 가 null 이면 스택, 아니면 그 반복 블록의 body. */
export type DropTarget = { parentId: string | null; index: number };

const isFixedEntry = (node: BlockNode) => node.kind === 'start' || node.kind === 'end';

/**
 * nodes(와 그 안의 반복 body) 에서 id 를 찾아, 그 블록부터 같은 목록 끝까지를 떼어낸다.
 * 최상위 스택에서는 고정된 종료를 남긴다. 찾지 못하면 null.
 */
function splitAt(
  nodes: BlockNode[],
  id: string,
  keepTrailingEnd: boolean,
): { remaining: BlockNode[]; carried: BlockNode[] } | null {
  const index = nodes.findIndex((n) => n.id === id);
  if (index >= 0) {
    if (isFixedEntry(nodes[index])) return null;
    const tail = nodes.slice(index);
    const end = keepTrailingEnd && tail.at(-1)?.kind === 'end' ? tail.slice(-1) : [];
    return {
      remaining: [...nodes.slice(0, index), ...end],
      carried: end.length > 0 ? tail.slice(0, -1) : tail,
    };
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (node.kind !== 'repeat') continue;
    const inner = splitAt(node.body, id, false);
    if (inner) {
      const next = [...nodes];
      next[i] = { ...node, body: inner.remaining };
      return { remaining: next, carried: inner.carried };
    }
  }
  return null;
}

function groupOf(floating: FloatingGroup[], id: string): FloatingGroup | undefined {
  return floating.find((g) => containsId(g.blocks, id));
}

/** 잡은 블록 + 같은 목록에서 그 아래 연결된 블록들 (기명서: "아래에 연결된 블록은 함께 이동한다"). */
export function carriedBlocks(program: BlockProgram, pick: DragPick): BlockNode[] {
  if (pick.origin === 'palette') return [pick.node];
  if (pick.origin === 'stack') return splitAt(program.stack, pick.nodeId, true)?.carried ?? [];
  const group = groupOf(program.floating, pick.nodeId);
  return group ? (splitAt(group.blocks, pick.nodeId, false)?.carried ?? []) : [];
}

/** 집은 블록들을 원래 자리에서 떼어낸다. (스택·반복 body 는 잘라내고, 그룹은 나머지만 남긴다.) */
function detachCarried(program: BlockProgram, pick: DragPick): BlockProgram {
  if (pick.origin === 'palette') return program;
  if (pick.origin === 'stack') {
    const split = splitAt(program.stack, pick.nodeId, true);
    return split ? { ...program, stack: split.remaining } : program;
  }
  const group = groupOf(program.floating, pick.nodeId);
  if (!group) return program;
  const split = splitAt(group.blocks, pick.nodeId, false);
  if (!split) return program;
  const floating =
    split.remaining.length > 0
      ? program.floating.map((g) => (g.id === group.id ? { ...g, blocks: split.remaining } : g))
      : program.floating.filter((g) => g.id !== group.id);
  return { ...program, floating };
}

/** 반복 블록 안에 넣을 수 없는 체인인지 (반복 중첩 금지, 시작·종료 불가). */
export function canNestInRepeat(carried: BlockNode[]): boolean {
  return carried.every((node) => node.kind !== 'repeat' && !isFixedEntry(node));
}

function insertIntoRepeat(
  nodes: BlockNode[],
  repeatId: string,
  index: number,
  carried: BlockNode[],
): { nodes: BlockNode[]; inserted: boolean } {
  let inserted = false;
  const next = nodes.map((node) => {
    if (inserted || node.kind !== 'repeat') return node;
    if (node.id === repeatId) {
      inserted = true;
      const at = Math.max(0, Math.min(node.body.length, index));
      return { ...node, body: [...node.body.slice(0, at), ...carried, ...node.body.slice(at)] };
    }
    return node;
  });
  return { nodes: next, inserted };
}

/** 스냅 거리 안에서 놓았다 — 집은 체인을 스택 또는 반복 body 의 target 위치에 연결한다. */
export function dropOnSlot(
  program: BlockProgram,
  pick: DragPick,
  target: DropTarget,
): BlockProgram {
  const carried = carriedBlocks(program, pick);
  if (carried.length === 0) return program;
  if (target.parentId !== null && !canNestInRepeat(carried)) return program;

  const base = detachCarried(program, pick);
  if (target.parentId === null) {
    // 시작(0) 뒤 ~ 종료 앞까지만 끼울 수 있다.
    const last = base.stack.at(-1)?.kind === 'end' ? base.stack.length - 1 : base.stack.length;
    const at = Math.max(1, Math.min(last, target.index));
    return { ...base, stack: [...base.stack.slice(0, at), ...carried, ...base.stack.slice(at)] };
  }
  // 반복 body 는 스택에 연결된 반복에만 넣는다(자유 블록 그룹의 반복은 스냅 대상이 아니다).
  const result = insertIntoRepeat(base.stack, target.parentId, target.index, carried);
  return result.inserted ? { ...base, stack: result.nodes } : program;
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

/**
 * 쓰레기통에 드롭 — 잡은 체인을 원래 자리에서 통째로 지운다 (기명서 "블록 삭제":
 * "연결된 블록 묶음을 드래그한 경우에는 함께 이동 중인 하위 연결 블록도 같이 삭제한다").
 * 시작·종료는 애초에 못 집으므로(carriedBlocks) 여기서 따로 막을 필요가 없다.
 */
export function deleteCarried(program: BlockProgram, pick: DragPick): BlockProgram {
  const carried = carriedBlocks(program, pick);
  if (carried.length === 0) return program;
  return detachCarried(program, pick);
}

type BlockParamPatch = { count?: number; distanceM?: number; seconds?: number; degrees?: number };

function containsId(nodes: BlockNode[], id: string): boolean {
  return nodes.some(
    (node) => node.id === id || (node.kind === 'repeat' && containsId(node.body, id)),
  );
}

function mapBlockParam(nodes: BlockNode[], id: string, patch: BlockParamPatch): BlockNode[] {
  return nodes.map((node) => {
    const next = node.id === id ? ({ ...node, ...patch } as BlockNode) : node;
    return next.kind === 'repeat' ? { ...next, body: mapBlockParam(next.body, id, patch) } : next;
  });
}

/**
 * 특정 블록의 파라미터(반복 횟수·이동 거리 등)만 바꾼다. 트리 어디에 있든(스택이든 자유
 * 블록이든, 반복 안이든) 찾아서 바꾸되, id 가 실제로 있는 쪽만 새로 만든다 — 편집할 때마다
 * 관계없는 자유 블록 그룹까지 전부 새로 할당하지 않는다.
 */
export function setBlockParam(
  program: BlockProgram,
  id: string,
  patch: BlockParamPatch,
): BlockProgram {
  if (containsId(program.stack, id)) {
    return { ...program, stack: mapBlockParam(program.stack, id, patch) };
  }
  const floating = program.floating.map((g) =>
    containsId(g.blocks, id) ? { ...g, blocks: mapBlockParam(g.blocks, id, patch) } : g,
  );
  return { ...program, floating };
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

const BLOCK_KINDS: readonly BlockKind[] = [
  'start',
  'repeat',
  'move',
  'moveForward',
  'rotateLeft',
  'rotateRight',
  'stop',
  'greet',
  'sit',
  'standUp',
  'heart',
  'dance',
  'roll',
  'attack',
  'wait',
  'end',
];

/** 블록 종류별 필수 필드까지 확인한다 — 손상된 스냅샷을 그대로 렌더하면 화면이 죽는다. */
function isBlockNode(value: unknown): value is BlockNode {
  if (typeof value !== 'object' || value === null) return false;
  const node = value as Record<string, unknown>;
  if (typeof node.id !== 'string' || typeof node.kind !== 'string') return false;
  if (!BLOCK_KINDS.includes(node.kind as BlockKind)) return false;

  switch (node.kind as BlockKind) {
    case 'move':
    case 'moveForward':
      return typeof node.distanceM === 'number';
    case 'rotateLeft':
    case 'rotateRight':
      return typeof node.degrees === 'number';
    case 'wait':
      return typeof node.seconds === 'number';
    case 'repeat':
      return (
        typeof node.count === 'number' && Array.isArray(node.body) && node.body.every(isBlockNode)
      );
    default:
      return true; // start · end · stop · greet · sit · standUp · heart · dance · roll · attack 는 추가 필드가 없다
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

const bodyOf = (node: BlockNode) => (node.kind === 'repeat' ? node.body : undefined);

/** stack·floating 을 통틀어(반복 body 안까지) 특정 종류가 몇 번 나오는지. */
function countKind(nodes: BlockNode[], kind: BlockKind): number {
  return sumOverBlockTree(nodes, {
    valueOf: (node) => (node.kind === kind ? 1 : 0),
    bodyOf,
    repeatCountOf: () => 1, // 구조적으로만 센다 — 반복 횟수를 곱하지 않는다
  });
}

/**
 * program(스택 + 자유 블록) 어디든 해당 종류가 하나라도 있는지.
 * 팔레트에서 종료처럼 프로그램에 많아야 하나 있어야 하는 블록을 중복 생성하지 못하게
 * 막는 데 쓴다 — 중복되면 자동 저장 스냅샷 검증(isBlockProgramSnapshot)이 다음 복원 때
 * 전체 초안을 거부해 작업이 통째로 사라진다.
 */
export function hasBlockKind(program: BlockProgram, kind: BlockKind): boolean {
  const floatingBlocks = program.floating.flatMap((g) => g.blocks);
  return countKind([...program.stack, ...floatingBlocks], kind) > 0;
}

/** repeat.body 안에는 start·end·repeat 가 들어갈 수 없다 (반복 중첩 금지). */
function hasInvalidRepeatBody(nodes: BlockNode[]): boolean {
  return nodes.some(
    (node) =>
      node.kind === 'repeat' &&
      node.body.some((b) => b.kind === 'start' || b.kind === 'end' || b.kind === 'repeat'),
  );
}

/**
 * 자동 저장이 남긴 프로그램 스냅샷인지 확인한다.
 * 노드 모양뿐 아니라 구조 불변식도 지킨다 — start 는 정확히 하나이고 스택 맨 앞에만,
 * end 는 많아야 하나(스택 끝이거나 자유 블록으로), 반복 안에는 start·end 가 못 들어간다 —
 * 그래야 복원 직후 화면이 깨지지 않는다.
 */
export function isBlockProgramSnapshot(value: unknown): value is BlockProgram {
  if (typeof value !== 'object' || value === null) return false;
  const snap = value as Record<string, unknown>;
  if (!Array.isArray(snap.stack) || !Array.isArray(snap.floating)) return false;
  if (!snap.stack.every(isBlockNode) || !snap.floating.every(isFloatingGroup)) return false;

  const stack = snap.stack as BlockNode[];
  const floating = snap.floating as FloatingGroup[];
  const floatingBlocks = floating.flatMap((g) => g.blocks);
  const allNodes = [...stack, ...floatingBlocks];

  if (stack[0]?.kind !== 'start') return false;
  if (countKind(allNodes, 'start') !== 1) return false;
  if (countKind(allNodes, 'end') > 1) return false;
  if (hasInvalidRepeatBody(stack) || hasInvalidRepeatBody(floatingBlocks)) return false;

  return true;
}

/**
 * 저장된 스냅샷을 프로그램으로 되돌린다.
 * 프로그램 스냅샷이면 고정 구조(시작 … 종료)로 맞춰서, 아니면 초기 프로그램으로 시작한다.
 * 이전 버전 초안은 종료가 자유 블록이거나 빠져 있을 수 있어, 종료를 스택 끝으로 옮긴다.
 */
export function draftToProgram(snapshot: unknown): BlockProgram {
  if (!isBlockProgramSnapshot(snapshot)) return INITIAL_PROGRAM;
  const floatingEnd = snapshot.floating.flatMap((g) => g.blocks).find((b) => b.kind === 'end');
  const floating = snapshot.floating
    .map((g) => ({ ...g, blocks: g.blocks.filter((b) => b.kind !== 'end') }))
    .filter((g) => g.blocks.length > 0);
  const body = snapshot.stack.filter((n) => n.kind !== 'end');
  const end =
    snapshot.stack.find((n) => n.kind === 'end') ??
    floatingEnd ??
    ({ id: 'end-0', kind: 'end' } as BlockNode);
  return { stack: [...body, end], floating };
}

// ── 검증 · 이동 거리 ──────────────────────────────────────────────────────────

export type BlockErrorCode =
  'disconnected-block' | 'missing-end' | 'unsupported-block' | 'empty-repeat';

/** Poppy-Server 블록 계약에 대응 타입이 없는 종류 (toServerBlockProgram 참고 — 검증된 프리셋이
 *  없어 팔레트에서도 숨겼다). 여기 없는 종류만 저장·시뮬레이션을 진행한다. */
const SERVER_UNSUPPORTED_KINDS: readonly BlockKind[] = ['roll', 'attack'];

/** 입(body)이 빈 반복 블록이 있는지 (반복 중첩은 금지라 한 단계만 본다). */
export function isEmptyRepeat(node: BlockNode): boolean {
  return node.kind === 'repeat' && node.body.length === 0;
}

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

  if (floatingKinds.length > 0) {
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

  const floatingBlocks = program.floating.flatMap((g) => g.blocks);
  const allNodes = [...program.stack, ...floatingBlocks];
  const unsupportedKind = SERVER_UNSUPPORTED_KINDS.find((kind) => countKind(allNodes, kind) > 0);
  if (unsupportedKind) {
    errors.push({
      code: 'unsupported-block',
      message: '아직 로봇 실행에서 지원되지 않는 블록이 있어요. 빼주세요.',
    });
  }
  if (program.stack.some(isEmptyRepeat)) {
    errors.push({
      code: 'empty-repeat',
      message: '빈 반복 블록이 있어요. 반복할 블록을 안에 넣어 주세요.',
    });
  }

  return errors;
}

/**
 * 실행순서 등 읽기 전용 목록에 쓰는 한 줄 설명 (Figma Slide 6·7). SimulationStep 은 repeat 를
 * 실제 반복 횟수만큼 펼친 뒤라 leaf 명령만 들어오는데, repeat 자신도 이 함수에선 방어적으로
 * 처리해둔다.
 */
export function describeBlock(node: SerializedBlockNode): string {
  switch (node.kind) {
    case 'start':
      return '시작';
    case 'end':
      return '종료';
    case 'greet':
      return '인사하기';
    case 'move':
      return `뒤로 ${node.distanceM}m 이동`;
    case 'moveForward':
      return `앞으로 ${node.distanceM}m 이동`;
    case 'rotateLeft':
      return `왼쪽으로 ${node.degrees}° 회전`;
    case 'rotateRight':
      return `오른쪽으로 ${node.degrees}° 회전`;
    case 'wait':
      return `${node.seconds}초 기다리기`;
    case 'stop':
      return '정지';
    case 'sit':
      return '앉기';
    case 'standUp':
      return '일어서기';
    case 'heart':
      return '하트';
    case 'dance':
      return '춤추기';
    case 'roll':
      return '구르기';
    case 'attack':
      return '공격';
    case 'repeat':
      return '번 반복하기';
  }
}

/** 프로그램이 로봇을 움직이는 총 거리 (m). 명세: "제한을 우회하는 중첩·합산 값도 계산". */
export function totalTravelDistance(program: BlockProgram): number {
  return sumOverBlockTree(program.stack, {
    valueOf: (node) => (node.kind === 'move' || node.kind === 'moveForward' ? node.distanceM : 0),
    bodyOf,
    repeatCountOf: (node) => (node.kind === 'repeat' ? node.count : 1),
  });
}
