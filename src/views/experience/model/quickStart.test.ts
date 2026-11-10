import { describe, expect, it } from 'vitest';

import { evaluateProgram } from '@/features/simulation';

import { INITIAL_PROGRAM, serializeProgram, validateBlockProgram } from './blockProgram';
import { QUICK_START_TEMPLATES, applyQuickStartTemplate } from './quickStart';

describe('빠른 시작 템플릿', () => {
  it.each(QUICK_START_TEMPLATES.map((t) => [t.id, t.label] as const))(
    '%s(%s) 는 시작·종료를 유지하고 6m×6m 시뮬레이션을 통과한다',
    (id) => {
      const program = applyQuickStartTemplate(INITIAL_PROGRAM, id);
      expect(program.stack[0]).toEqual(INITIAL_PROGRAM.stack[0]);
      expect(program.stack.at(-1)).toEqual(INITIAL_PROGRAM.stack.at(-1));
      expect(program.floating).toEqual([]);
      expect(validateBlockProgram(program)).toEqual([]);

      const evaluation = evaluateProgram(serializeProgram(program));
      expect(evaluation.runnable).toBe(true);
    },
  );

  it('템플릿마다 블록 id 가 서로 다르고, 다시 적용해도 새 id 를 만든다', () => {
    const first = applyQuickStartTemplate(INITIAL_PROGRAM, 'squareWalk');
    const second = applyQuickStartTemplate(INITIAL_PROGRAM, 'squareWalk');
    const idsOf = (p: typeof first) =>
      p.stack.flatMap((n) => [n.id, ...(n.kind === 'repeat' ? n.body.map((b) => b.id) : [])]);
    const firstIds = idsOf(first);
    expect(new Set(firstIds).size).toBe(firstIds.length);
    expect(first.stack[1].id).not.toBe(second.stack[1].id);
  });

  it('모르는 템플릿 id 면 프로그램을 그대로 둔다', () => {
    const next = applyQuickStartTemplate(
      INITIAL_PROGRAM,
      'nope' as unknown as (typeof QUICK_START_TEMPLATES)[number]['id'],
    );
    expect(next).toBe(INITIAL_PROGRAM);
  });
});
