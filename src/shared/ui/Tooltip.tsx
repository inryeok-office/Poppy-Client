'use client';

import { useId, type ReactNode } from 'react';

type TooltipProps = {
  /** 마우스를 올리거나 키보드로 포커스하면 보여줄 짧은 설명 */
  text: string;
  children: ReactNode;
  className?: string;
};

/**
 * 가벼운 설명 툴팁 — hover·focus-within 때 위쪽에 말풍선을 띄운다. 스크린 리더용으로 같은 문구를
 * aria-describedby 대상(role="tooltip")으로 항상 DOM 에 둔다.
 */
export function Tooltip({ text, children, className = '' }: TooltipProps) {
  const id = useId();
  return (
    <span className={`group relative inline-flex ${className}`} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="bg-ink pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-2 -translate-x-1/2 rounded px-2 py-1 text-[12px] whitespace-nowrap text-white opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
