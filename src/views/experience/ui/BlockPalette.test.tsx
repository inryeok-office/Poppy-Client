import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlockDragProvider } from '../lib/useBlockDrag';
import { INITIAL_PROGRAM } from '../model/blockProgram';
import { BlockPalette } from './BlockPalette';

afterEach(() => vi.unstubAllEnvs());

function renderPalette() {
  return render(
    <BlockDragProvider program={INITIAL_PROGRAM} onChange={() => {}}>
      <BlockPalette />
    </BlockDragProvider>,
  );
}

describe('BlockPalette — 앉기 블록 노출', () => {
  it('기본(NEXT_PUBLIC_ENABLE_SIT_BLOCK 꺼짐)으로는 팔레트에서 숨긴다', () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: '동작' }));
    expect(screen.queryByRole('button', { name: '앉기 블록 꺼내기' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일어서기 블록 꺼내기' })).toBeInTheDocument();
  });

  it('NEXT_PUBLIC_ENABLE_SIT_BLOCK=true 면 팔레트에 보인다', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_SIT_BLOCK', 'true');
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: '동작' }));
    expect(screen.getByRole('button', { name: '앉기 블록 꺼내기' })).toBeInTheDocument();
  });
});

describe('BlockPalette — 정지 블록 노출', () => {
  const moveNames = () => {
    renderPalette();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    return screen
      .getAllByRole('button')
      .map((b) => b.getAttribute('aria-label'))
      .filter((n): n is string => n?.endsWith('꺼내기') ?? false);
  };

  it('기본(NEXT_PUBLIC_ENABLE_STOP_BLOCK 꺼짐)으로는 팔레트에서 숨긴다', () => {
    expect(moveNames()).not.toContain('정지 블록 꺼내기');
  });

  it('NEXT_PUBLIC_ENABLE_STOP_BLOCK=true 면 팔레트에 보인다', () => {
    vi.stubEnv('NEXT_PUBLIC_ENABLE_STOP_BLOCK', 'true');
    expect(moveNames()).toContain('정지 블록 꺼내기');
  });
});
