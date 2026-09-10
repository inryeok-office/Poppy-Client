// 팔레트 카테고리별 블록 목록 (Figma node 21:520 — Frame 6 레일 · Frame 7 블록 목록).
// '시작' 블록 자체는 캔버스에 늘 있으니 팔레트엔 없다. '종료' 는 시작 카테고리에서 꺼낸다.

import type { BlockKind } from './blockProgram';

export type BlockCategory = {
  id: string;
  label: string;
  /** 카테고리 색 칩 (@theme block-*) */
  colorClass: string;
};

export const CATEGORIES: BlockCategory[] = [
  { id: 'start', label: '시작', colorClass: 'bg-block-start' },
  { id: 'flow', label: '흐름', colorClass: 'bg-block-flow' },
  { id: 'move', label: '이동', colorClass: 'bg-block-move' },
  { id: 'action', label: '동작', colorClass: 'bg-block-action' },
];

/** 디자인상 처음 열려 있는 카테고리 (Figma: 흐름). */
export const DEFAULT_CATEGORY = 'flow';

export type PaletteEntry = { kind: BlockKind; category: string };

export const PALETTE_BLOCKS: PaletteEntry[] = [
  { kind: 'end', category: 'start' },
  { kind: 'wait', category: 'flow' },
  { kind: 'repeat', category: 'flow' },
  { kind: 'move', category: 'move' },
  { kind: 'greet', category: 'action' },
];

export function blocksInCategory(category: string): PaletteEntry[] {
  return PALETTE_BLOCKS.filter((entry) => entry.category === category);
}

const LABELS: Record<BlockKind, string> = {
  start: '시작',
  end: '종료',
  greet: '인사하기',
  move: '이동',
  wait: '기다리기',
  repeat: '반복하기',
};

/** 블록의 짧은 이름 (버튼 라벨·안내 문구용). */
export function blockLabel(kind: BlockKind): string {
  return LABELS[kind];
}
