// AI 초안(features/ai) ↔ 캔버스 블록 변환. features 는 views 를 참조하지 않으므로
// AiStep → BlockNode 변환은 여기(views 쪽)가 맡는다.
//
// 적용 규칙(명세): 시작·종료는 유지하고 그 사이(스택 중간)와 떠 있는 블록은 모두 바꾼다.
// 반영 후에는 기존 invalidate 흐름대로 시뮬레이션부터 다시 거친다 — 여기서는 프로그램만
// 바꾸고, 호출하는 쪽(ExperienceView)이 invalidate 를 이어서 부른다.

import type { AiHintRequest, AiProgramDraft, AiStep } from '@/features/ai';
import type { SimulationResult } from '@/features/simulation';

import { describeBlock } from './blockProgram';
import type { BlockNode, BlockProgram } from './blockProgram';

function nextAiBlockId(prefix: string): string {
  return `ai-${prefix}-${crypto.randomUUID()}`;
}

function toBlockNode(step: AiStep): BlockNode {
  switch (step.kind) {
    case 'repeat':
      return {
        id: nextAiBlockId('repeat'),
        kind: 'repeat',
        count: step.count,
        body: step.body.map(toBlockNode),
      };
    case 'moveForward':
    case 'move':
      return { id: nextAiBlockId(step.kind), kind: step.kind, distanceM: step.distanceM };
    case 'rotateLeft':
    case 'rotateRight':
      return { id: nextAiBlockId(step.kind), kind: step.kind, degrees: step.degrees };
    case 'wait':
      return { id: nextAiBlockId('wait'), kind: 'wait', seconds: step.seconds };
    default:
      return { id: nextAiBlockId(step.kind), kind: step.kind };
  }
}

/** AI 초안을 캔버스에 반영한 새 프로그램. 시작·종료는 기존 것을 유지하고 그 사이와 떠 있는
 *  블록은 모두 초안으로 바꾼다(새 id 로 만들어 기존 블록과 겹치지 않는다). */
export function applyAiDraft(program: BlockProgram, draft: AiProgramDraft): BlockProgram {
  const start = program.stack.find((node) => node.kind === 'start') ?? {
    id: 'start-0',
    kind: 'start',
  };
  const end = program.stack.find((node) => node.kind === 'end') ?? { id: 'end-0', kind: 'end' };
  return { stack: [start, ...draft.steps.map(toBlockNode), end], floating: [] };
}

/** AI 패널에서 초안을 미리 보여줄 한 줄 설명. */
export function describeAiStep(step: AiStep): string {
  switch (step.kind) {
    case 'repeat':
      return `${step.count}번 반복: ${step.body.map(describeAiStep).join(', ')}`;
    case 'moveForward':
      return `앞으로 ${step.distanceM}m 이동`;
    case 'move':
      return `뒤로 ${step.distanceM}m 이동`;
    case 'rotateLeft':
      return `왼쪽으로 ${step.degrees}° 회전`;
    case 'rotateRight':
      return `오른쪽으로 ${step.degrees}° 회전`;
    case 'wait':
      return `${step.seconds}초 기다리기`;
    case 'stop':
      return '정지';
    case 'standUp':
      return '일어서기';
    case 'greet':
      return '인사하기';
    case 'heart':
      return '하트';
    case 'dance':
      return '춤추기';
  }
}

const BLOCK_NUMBER_PATTERN = /(\d+)번째 블록/;

/** 실패한 SimulationResult 로 힌트 요청을 만든다("N번째 블록"에서 번호를 뽑는다). */
export function buildAiHintRequest(result: SimulationResult): AiHintRequest {
  const violation = result.violations[0];
  const match = violation?.message.match(BLOCK_NUMBER_PATTERN);
  return {
    programLines: result.steps.map((step) => describeBlock(step.node)),
    violationCode: violation?.code,
    violationMessage: violation?.message,
    violationBlockNumber: match ? Number(match[1]) : undefined,
  };
}
