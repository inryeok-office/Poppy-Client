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
