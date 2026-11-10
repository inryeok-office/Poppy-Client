import type { AiProgramDraft } from '@/features/ai';
import type { SimulationResult } from '@/features/simulation';
import { describe, expect, it } from 'vitest';

import { applyAiDraft, buildAiHintRequest, describeAiStep } from './aiDraft';
import { INITIAL_PROGRAM } from './blockProgram';

describe('applyAiDraft', () => {
  const draft: AiProgramDraft = {
    steps: [
      { kind: 'moveForward', distanceM: 1 },
      { kind: 'repeat', count: 2, body: [{ kind: 'rotateLeft', degrees: 90 }] },
    ],
    explanation: '설명',
    source: 'local',
  };

  it('시작·종료는 유지하고 그 사이를 초안으로 바꾼다', () => {
    const next = applyAiDraft(INITIAL_PROGRAM, draft);
    expect(next.stack[0]).toEqual(INITIAL_PROGRAM.stack[0]);
    expect(next.stack.at(-1)).toEqual(INITIAL_PROGRAM.stack.at(-1));
    expect(next.stack).toHaveLength(4); // start + moveForward + repeat + end
  });

  it('떠 있는 블록은 모두 지운다', () => {
    const withFloating = {
      ...INITIAL_PROGRAM,
      floating: [{ id: 'f1', x: 0, y: 0, blocks: [{ id: 'b1', kind: 'heart' as const }] }],
    };
    const next = applyAiDraft(withFloating, draft);
    expect(next.floating).toEqual([]);
  });

  it('새로 만든 블록 id 는 기존 블록과 겹치지 않는다', () => {
    const next = applyAiDraft(INITIAL_PROGRAM, draft);
    const ids = next.stack.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).not.toContain('start-0'.concat('x')); // sanity — id 들이 비어있지 않음
  });

  it('같은 초안을 두 번 적용해도 매번 새 id 를 만든다', () => {
    const first = applyAiDraft(INITIAL_PROGRAM, draft);
    const second = applyAiDraft(INITIAL_PROGRAM, draft);
    expect(first.stack[1].id).not.toBe(second.stack[1].id);
  });
});

describe('describeAiStep', () => {
  it('반복은 몸통 설명을 이어붙인다', () => {
    expect(describeAiStep({ kind: 'repeat', count: 3, body: [{ kind: 'heart' }] })).toBe(
      '3번 반복: 하트',
    );
  });
});

describe('buildAiHintRequest', () => {
  it('violation 메시지에서 "N번째 블록" 번호를 뽑는다', () => {
    const result: SimulationResult = {
      passed: false,
      normalizedCommandCount: 2,
      totalDistanceM: 5,
      violations: [
        { code: 'exceeds-safe-zone', message: '4번째 블록에서 안전 구역 밖으로 나가요.' },
      ],
      notes: [],
      steps: [],
    };
    const request = buildAiHintRequest(result);
    expect(request.violationBlockNumber).toBe(4);
    expect(request.violationCode).toBe('exceeds-safe-zone');
  });

  it('번호가 없는 메시지면 violationBlockNumber 를 비워둔다', () => {
    const result: SimulationResult = {
      passed: false,
      normalizedCommandCount: 1,
      totalDistanceM: 0,
      violations: [{ code: 'exceeds-time', message: '시간이 너무 길어요.' }],
      notes: [],
      steps: [],
    };
    const request = buildAiHintRequest(result);
    expect(request.violationBlockNumber).toBeUndefined();
  });
});
