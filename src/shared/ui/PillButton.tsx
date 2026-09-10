import type { ButtonHTMLAttributes } from 'react';

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * default — 카드색 배경 + 1px 경계선 + 보조색 텍스트 (헤더·툴바 버튼).
   * primary — 채워진 강조 버튼 + 흰 텍스트 (Figma Slide 3 활성 '시뮬레이션 하기').
   */
  variant?: 'default' | 'primary';
};

/**
 * 뽀삐 공통 알약 버튼. Figma "뽀삐"(node 21:520) 헤더·툴바 버튼 스타일.
 * 공통: 높이 40 · radius 8 · 좌우 24 패딩 · 14px. (Figma 버튼 프레임이 전부 h40)
 * disabled 면 네이티브가 클릭을 막고, aria-disabled(포커스는 유지)면 상호작용
 * 스타일을 끄고 onClick 도 실행되지 않게 가드한다.
 */
const BASE =
  'inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-lg px-6 text-[14px] whitespace-nowrap transition-colors';

const VARIANT = {
  default: 'border-line bg-card text-muted border',
  primary: 'bg-primary text-white',
} as const;

const INTERACTION = {
  default: 'cursor-pointer hover:bg-line/40 hover:text-ink active:bg-line/60',
  primary: 'cursor-pointer hover:bg-primary-hover active:bg-primary-active',
} as const;

export function PillButton({
  variant = 'default',
  className = '',
  type = 'button',
  onClick,
  ...props
}: PillButtonProps) {
  const inert =
    props.disabled || props['aria-disabled'] === true || props['aria-disabled'] === 'true';
  const state = inert ? 'cursor-not-allowed opacity-60' : INTERACTION[variant];

  return (
    <button
      type={type}
      // aria-disabled 는 네이티브 disabled 와 달리 클릭을 막지 않으므로 직접 가드한다.
      onClick={inert ? undefined : onClick}
      className={`${BASE} ${VARIANT[variant]} ${state} ${className}`}
      {...props}
    />
  );
}
