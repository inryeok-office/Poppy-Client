import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlockInput, blockInputWidth } from './Block';
import { ExperienceView } from './ExperienceView';
import { rectFor } from './dragTestKit';

const input = () => screen.getByRole('spinbutton');

describe('BlockInput — 입력 중 원문 유지, blur·Enter 때 반영', () => {
  it('입력 중에는 빈칸·"0." 원문을 그대로 두고 반영하지 않는다', () => {
    const onChange = vi.fn();
    render(<BlockInput value={0.5} onChange={onChange} min={0.1} max={3} step={0.1} />);
    fireEvent.change(input(), { target: { value: '' } });
    expect(input()).toHaveValue('');
    fireEvent.change(input(), { target: { value: '0.' } });
    expect(input()).toHaveValue('0.');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('blur 때 숫자로 반영한다', () => {
    const onChange = vi.fn();
    render(<BlockInput value={0.5} onChange={onChange} min={0.1} max={3} step={0.1} />);
    fireEvent.change(input(), { target: { value: '0.3' } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenCalledWith(0.3);
  });

  it('Enter 로도 반영하고, Esc 는 원래 값으로 되돌린다', () => {
    const onChange = vi.fn();
    render(<BlockInput value={90} onChange={onChange} min={1} max={360} />);
    fireEvent.change(input(), { target: { value: '45' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(45);

    fireEvent.change(input(), { target: { value: '7' } });
    fireEvent.keyDown(input(), { key: 'Escape' });
    expect(input()).toHaveValue('90');
  });

  it('범위 밖 값도 자동으로 고치지 않고 그대로 반영한다', () => {
    const onChange = vi.fn();
    render(<BlockInput value={0.5} onChange={onChange} min={0.1} max={3} step={0.1} />);
    fireEvent.change(input(), { target: { value: '5' } });
    fireEvent.blur(input());
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('빈칸·숫자가 아닌 입력은 반영하지 않고 이전 값으로 되돌린다', () => {
    const onChange = vi.fn();
    render(<BlockInput value={4} onChange={onChange} min={1} max={10} />);
    fireEvent.change(input(), { target: { value: '' } });
    fireEvent.blur(input());
    fireEvent.change(input(), { target: { value: 'abc' } });
    fireEvent.blur(input());
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue('4');
  });

  it('invalid 면 빨간 테두리와 aria-invalid', () => {
    render(<BlockInput value={11} onChange={() => {}} min={1} max={10} invalid />);
    expect(input()).toHaveClass('border-danger');
    expect(input()).toHaveAttribute('aria-invalid', 'true');
  });

  it('포커스하면 허용 범위 툴팁이 보인다', () => {
    render(<BlockInput value={1} onChange={() => {}} rangeHint="1~10초" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(input());
    expect(screen.getByRole('tooltip')).toHaveTextContent('1~10초');
    fireEvent.blur(input());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('너비는 값 길이에 맞춰 40~56px', () => {
    expect(blockInputWidth('1')).toBe(40);
    expect(blockInputWidth('360')).toBe(41);
    expect(blockInputWidth('0.5')).toBe(41);
    expect(blockInputWidth('1234567')).toBe(56);
  });
});

describe('편집기 — 범위 밖 값 안내와 팔레트 기본값', () => {
  afterEach(() => vi.restoreAllMocks());

  function renderView() {
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
    });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(rectFor);
    const program = {
      stack: [
        { id: 'start-0', kind: 'start' },
        {
          id: 'repeat-0',
          kind: 'repeat',
          count: 2,
          body: [{ id: 'move-0', kind: 'move', distanceM: 1 }],
        },
        { id: 'end-0', kind: 'end' },
      ],
      floating: [],
    };
    localStorage.setItem(
      'poppy.experience.draft',
      JSON.stringify({
        sessionId: '',
        program: {},
        blocks: program,
        projectVersion: 0,
        dirty: false,
      }),
    );
    return render(
      <QueryClientProvider client={queryClient}>
        <ExperienceView />
      </QueryClientProvider>,
    );
  }

  it('범위 밖 값이면 블록 아래 안내가 뜨고 시뮬레이션이 막힌다', () => {
    renderView();
    const repeat = screen.getByRole('spinbutton', { name: '반복 횟수' });
    fireEvent.change(repeat, { target: { value: '11' } });
    fireEvent.blur(repeat);

    expect(screen.getByRole('alert')).toHaveTextContent('1~10번 사이로 입력해 주세요');
    expect(repeat).toHaveValue('11');
    expect(screen.getByRole('button', { name: '시뮬레이션 하기' })).toHaveAttribute(
      'aria-disabled',
    );

    const distance = screen.getByRole('spinbutton', { name: '이동 거리 (미터)' });
    fireEvent.change(distance, { target: { value: '0.25' } });
    fireEvent.blur(distance);
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toContain(
      '0.1~3 m 사이로 입력해 주세요',
    );
  });

  it('팔레트 블록 입력칸에 기본값(0.5 m, 90°, 1초, 4번)이 보인다', () => {
    renderView();
    const palette = screen.getByRole('complementary', { name: '블록 팔레트' });
    expect(within(palette).getByText('1')).toBeInTheDocument();
    expect(within(palette).getByText('4')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이동' }));
    expect(within(palette).getAllByText('0.5')).toHaveLength(2);
    expect(within(palette).getAllByText('90')).toHaveLength(2);
  });
});
