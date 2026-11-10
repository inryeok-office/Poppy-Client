// 빠른 시작 템플릿 (체험 시간 단축) — 캔버스 상단에서 누르면 확인 후 시작~종료 사이를
// 통째로 바꾼다. 다른 블록 변경과 같은 흐름대로 invalidate 해 시뮬레이션부터 다시 거친다
// (ExperienceView 가 이어서 처리). 세 템플릿 모두 6m×6m 안전 구역을 통과한다(quickStart.test.ts).

import { DEFAULT_ROTATE_DEG, newBlock, type BlockNode, type BlockProgram } from './blockProgram';

export type QuickStartTemplateId = 'squareWalk' | 'lPath' | 'greetAndHeart';

export type QuickStartTemplate = {
  id: QuickStartTemplateId;
  label: string;
  confirmMessage: string;
  build: () => BlockNode[];
};

function moveForward(distanceM: number): BlockNode {
  const base = newBlock('moveForward') as Extract<BlockNode, { kind: 'moveForward' }>;
  return { ...base, distanceM };
}

function rotateLeft(degrees: number = DEFAULT_ROTATE_DEG): BlockNode {
  const base = newBlock('rotateLeft') as Extract<BlockNode, { kind: 'rotateLeft' }>;
  return { ...base, degrees };
}

export const QUICK_START_TEMPLATES: readonly QuickStartTemplate[] = [
  {
    id: 'squareWalk',
    label: '네모 걷기',
    confirmMessage: '지금 블록을 지우고 "네모 걷기"로 시작할까요?',
    build: () => {
      const repeat = newBlock('repeat') as Extract<BlockNode, { kind: 'repeat' }>;
      return [{ ...repeat, count: 4, body: [moveForward(1), rotateLeft(90)] }];
    },
  },
  {
    id: 'lPath',
    label: 'ㄱ자 길',
    confirmMessage: '지금 블록을 지우고 "ㄱ자 길"로 시작할까요?',
    build: () => [moveForward(2), rotateLeft(90), moveForward(2)],
  },
  {
    id: 'greetAndHeart',
    label: '인사하고 하트',
    confirmMessage: '지금 블록을 지우고 "인사하고 하트"로 시작할까요?',
    build: () => [newBlock('greet'), newBlock('heart')],
  },
];

/** 시작·종료는 유지하고 그 사이·떠 있는 블록을 템플릿으로 바꾼다. */
export function applyQuickStartTemplate(
  program: BlockProgram,
  templateId: QuickStartTemplateId,
): BlockProgram {
  const template = QUICK_START_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return program;
  const start = program.stack.find((node) => node.kind === 'start') ?? {
    id: 'start-0',
    kind: 'start' as const,
  };
  const end = program.stack.find((node) => node.kind === 'end') ?? {
    id: 'end-0',
    kind: 'end' as const,
  };
  return { stack: [start, ...template.build(), end], floating: [] };
}
