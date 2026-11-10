import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Block, CBlock, EmptyMouth, GhostBlock } from './Block';

// 브라우저 확대 200%에서 "오른쪽으로 90 ° 회전" 같은 블록 라벨이 두 줄로 깨지는 문제(행사
// 회고) — 라벨 줄은 whitespace-nowrap 으로 한 줄을 강제해야 한다. jsdom 은 실제 레이아웃
// 리플로우를 하지 않으므로, 줄바꿈이 아예 안 일어나게 하는 클래스가 붙어 있는지로 확인한다.

describe('블록 라벨 — 한 줄 유지', () => {
  it('Block(실행 블록) 라벨 줄에 whitespace-nowrap 이 있다', () => {
    render(<Block color="move">오른쪽으로 90 ° 회전</Block>);
    expect(screen.getByText('오른쪽으로 90 ° 회전').className).toContain('whitespace-nowrap');
  });

  it('CBlock(반복) 헤더 줄에 whitespace-nowrap 이 있다', () => {
    render(<CBlock color="flow" header="4번 반복하기" />);
    expect(screen.getByText('4번 반복하기').className).toContain('whitespace-nowrap');
  });

  it('EmptyMouth 안내 문구에 whitespace-nowrap 이 있다', () => {
    render(<EmptyMouth />);
    expect(screen.getByText('반복할 블록을 넣어 주세요').className).toContain('whitespace-nowrap');
  });

  it('GhostBlock 안내 문구에 whitespace-nowrap 이 있다', () => {
    render(<GhostBlock>다음 블록을 붙여주세요</GhostBlock>);
    expect(screen.getByText('다음 블록을 붙여주세요').className).toContain('whitespace-nowrap');
  });
});
