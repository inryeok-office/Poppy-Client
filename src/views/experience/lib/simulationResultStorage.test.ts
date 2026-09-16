import { afterEach, describe, expect, it, vi } from 'vitest';

import type { SimulationResult } from '@/features/simulation';

import { INITIAL_PROGRAM, type BlockProgram } from '../model/blockProgram';
import {
  clearSimulationResult,
  isResultForProgram,
  readSimulationResult,
  writeSimulationResult,
} from './simulationResultStorage';

const CONNECTED_PROGRAM: BlockProgram = {
  stack: [...INITIAL_PROGRAM.stack, { id: 'end-0', kind: 'end' }],
  floating: [],
};

const PASSED_RESULT: SimulationResult = {
  passed: true,
  normalizedCommandCount: 4,
  totalDistanceM: 2,
  violations: [],
  notes: [],
};

afterEach(() => {
  vi.restoreAllMocks();
  clearSimulationResult();
});

describe('writeSimulationResult / readSimulationResult — 왕복', () => {
  it('쓴 그대로 읽힌다', () => {
    expect(writeSimulationResult({ program: CONNECTED_PROGRAM, result: PASSED_RESULT })).toBe(true);
    expect(readSimulationResult()).toEqual({ program: CONNECTED_PROGRAM, result: PASSED_RESULT });
  });

  it('아무것도 저장하지 않았으면 null', () => {
    expect(readSimulationResult()).toBeNull();
  });
});

describe('writeSimulationResult — 저장 실패 (inryeok-bot 리뷰: 실패해도 결과 화면으로 이동하면 안 됨)', () => {
  it('sessionStorage.setItem 이 던지면 false 를 반환한다 (용량 초과 등)', () => {
    // Storage.prototype 은 localStorage 와 공유돼, sessionStorage 호출일 때만 던지고
    // localStorage 호출은 그대로 통과시켜야 다른 저장(자동 저장 등)에 영향이 없다.
    const proto = Object.getPrototypeOf(window.sessionStorage) as Storage;
    const original = proto.setItem;
    vi.spyOn(proto, 'setItem').mockImplementation(function (this: Storage, key, value) {
      if (this === window.sessionStorage) throw new DOMException('QuotaExceededError');
      return original.call(this, key, value);
    });

    expect(writeSimulationResult({ program: CONNECTED_PROGRAM, result: PASSED_RESULT })).toBe(
      false,
    );
  });
});

describe('readSimulationResult — 손상된 저장값은 신뢰하지 않는다 (inryeok-bot 리뷰: 구조 검증 없이 단언)', () => {
  it('JSON 구문 자체가 깨졌으면 null', () => {
    window.sessionStorage.setItem('poppy.experience.simulationResult', '{ not json');
    expect(readSimulationResult()).toBeNull();
  });

  it('program 이 유효한 BlockProgram 스냅샷이 아니면 null (필드 누락)', () => {
    window.sessionStorage.setItem(
      'poppy.experience.simulationResult',
      JSON.stringify({ program: { stack: [], floating: [] }, result: PASSED_RESULT }),
    );
    expect(readSimulationResult()).toBeNull();
  });

  it('result 에 필수 필드가 없으면 null', () => {
    window.sessionStorage.setItem(
      'poppy.experience.simulationResult',
      JSON.stringify({ program: CONNECTED_PROGRAM, result: { passed: true } }),
    );
    expect(readSimulationResult()).toBeNull();
  });

  it('result.passed 타입이 어긋나면 null', () => {
    window.sessionStorage.setItem(
      'poppy.experience.simulationResult',
      JSON.stringify({
        program: CONNECTED_PROGRAM,
        result: { ...PASSED_RESULT, passed: 'yes' },
      }),
    );
    expect(readSimulationResult()).toBeNull();
  });
});

describe('isResultForProgram', () => {
  it('저장된 program 과 같으면 true', () => {
    expect(
      isResultForProgram({ program: CONNECTED_PROGRAM, result: PASSED_RESULT }, CONNECTED_PROGRAM),
    ).toBe(true);
  });

  it('저장된 게 없거나 program 이 다르면 false', () => {
    expect(isResultForProgram(null, CONNECTED_PROGRAM)).toBe(false);
    expect(
      isResultForProgram({ program: CONNECTED_PROGRAM, result: PASSED_RESULT }, INITIAL_PROGRAM),
    ).toBe(false);
  });
});
