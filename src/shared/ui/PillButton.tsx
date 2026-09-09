import type { ButtonHTMLAttributes } from 'react';

type PillButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /**
   * default — 카드색 배경 + 1px 경계선 + 보조색 텍스트 (헤더·툴바 버튼).
   * primary — 채워진 강조 버튼 + 흰 텍스트 (Figma Slide 3 활성 '시뮬레이션 하기').
   */
  variant?: 'default' | 'primary';
};

/**
 * 뽀샤 공통 알약 버튼. Figma "뽀샤"(node 21:520) 헤더·툴바 버튼 스타일.
 * 공통: 높이 40 · radius 8 · 좌우 24 패딩 · 14px. (Figma 버튼 프레임이 전부 h40)
 * UI 퍼블리싱 단계라 hover/focus/disabled 등 상태 스타일은 넣지 않는다(디자인대로만).
 */
const VARIANT = {
  default: 'border-line bg-card text-muted border',
  primary: 'bg-primary text-white',
} as const;

export function PillButton({
  variant = 'default',
  className = '',
  type = 'button',
  ...props
}: PillButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-1 rounded-lg px-6 text-[14px] ${VARIANT[variant]} ${className}`}
      {...props}
    />
  );
}
