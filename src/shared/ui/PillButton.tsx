import type { ButtonHTMLAttributes } from 'react';

/**
 * 뽀샤 공통 알약 버튼. Figma "뽀샤"(node 21:520)의 헤더·툴바 버튼 스타일.
 * 카드색 배경 · 1px 경계선 · radius 8 · 좌우 24 상하 11 패딩 · 14px 보조색.
 */
export function PillButton({
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`border-line bg-card text-muted hover:text-ink inline-flex items-center gap-1 rounded-lg border px-6 py-[11px] text-[14px] transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${className}`}
      {...props}
    />
  );
}
