import { afterEach, describe, expect, it, vi } from 'vitest';

import { generateHint, generateProgramDraft } from './hooks';
import * as aiApi from './aiApi';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('generateProgramDraft', () => {
  it('local 모드(기본)에서는 원격을 호출하지 않고 규칙 기반으로 만든다', async () => {
    const spy = vi.spyOn(aiApi, 'requestAiProgramDraft');
    const draft = await generateProgramDraft('네모를 그리면서 걸어 줘');
    expect(spy).not.toHaveBeenCalled();
    expect(draft.source).toBe('local');
    expect(draft.steps.length).toBeGreaterThan(0);
  });

  it('off 모드에서도 호출 자체는 로컬로 동작한다(렌더 여부는 UI 쪽 책임)', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'off');
    const draft = await generateProgramDraft('인사해 줘');
    expect(draft.source).toBe('local');
  });

  it('remote 모드에서 원격 호출이 성공하고 검증을 통과하면 그 결과를 쓴다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    vi.spyOn(aiApi, 'requestAiProgramDraft').mockResolvedValue({
      steps: [{ kind: 'greet' }],
      explanation: '원격 설명',
    });
    const draft = await generateProgramDraft('아무 말');
    expect(draft).toEqual({
      steps: [{ kind: 'greet' }],
      explanation: '원격 설명',
      source: 'remote',
    });
  });

  it('remote 호출이 실패하면 local 로 대신한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    vi.spyOn(aiApi, 'requestAiProgramDraft').mockRejectedValue(new Error('network'));
    const draft = await generateProgramDraft('네모를 그리면서 걸어 줘');
    expect(draft.source).toBe('local');
  });

  it('remote 응답이 검증을 통과하지 못하면 local 로 대신한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    vi.spyOn(aiApi, 'requestAiProgramDraft').mockResolvedValue({
      steps: [{ kind: 'sit' }],
      explanation: '앉아서 이동',
    });
    const draft = await generateProgramDraft('네모를 그리면서 걸어 줘');
    expect(draft.source).toBe('local');
  });
});

describe('generateHint', () => {
  const request = { programLines: ['앞으로 1m 이동'], violationCode: 'exceeds-safe-zone' as const };

  it('local 모드에서는 원격을 호출하지 않는다', async () => {
    const spy = vi.spyOn(aiApi, 'requestAiHint');
    const hint = await generateHint(request);
    expect(spy).not.toHaveBeenCalled();
    expect(hint.source).toBe('local');
  });

  it('remote 모드에서 원격 호출이 성공하면 그 메시지를 쓴다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    vi.spyOn(aiApi, 'requestAiHint').mockResolvedValue({ message: '원격 힌트' });
    const hint = await generateHint(request);
    expect(hint).toEqual({ message: '원격 힌트', source: 'remote' });
  });

  it('remote 호출이 실패하면 local 힌트로 대신한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    vi.spyOn(aiApi, 'requestAiHint').mockRejectedValue(new Error('timeout'));
    const hint = await generateHint(request);
    expect(hint.source).toBe('local');
  });

  it('remote 응답이 빈 메시지면 local 힌트로 대신한다', async () => {
    vi.stubEnv('NEXT_PUBLIC_AI_MODE', 'remote');
    vi.spyOn(aiApi, 'requestAiHint').mockResolvedValue({ message: '' });
    const hint = await generateHint(request);
    expect(hint.source).toBe('local');
  });
});
