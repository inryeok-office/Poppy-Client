'use client';

import { useState } from 'react';

import { PillButton } from '@/shared/ui';

import { GUIDE_TEXT, hintSteps, type GuideStep } from '../model/guide';
import { GhostBlock } from './Block';

type GuideBarProps = {
  step: GuideStep;
  /** 구조 오류·시뮬레이션 실패 문구 — 있으면 단계 안내보다 먼저 보인다. */
  alert?: string;
  collapsed: boolean;
  onToggle: () => void;
  /** 미션 모드면 단계 안내 대신 목표와 힌트를 보여준다. */
  mission?: { goal: string; composition?: string };
};

/**
 * 캔버스 위 한 줄 안내 띠. 상태에 따라 1/4 → 4/4 로 자동 진행하고, 오류가 있으면 오류가 먼저다.
 * 미션 모드에서는 "목표 + 힌트 보기"(권장 구성을 점선 블록으로, 처음엔 2개, 값은 '?').
 */
export function GuideBar({ step, alert, collapsed, onToggle, mission }: GuideBarProps) {
  const [hintOpen, setHintOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const steps = mission?.composition ? hintSteps(mission.composition) : [];
  const visibleSteps = showAll ? steps : steps.slice(0, 2);

  return (
    <div className="min-w-0 flex-1">
      <div className="flex min-h-12 items-center gap-2">
        <p className="text-ink flex min-w-0 items-center gap-2 text-[14px]" aria-live="polite">
          {alert ? (
            <>
              <span aria-hidden className="bg-danger size-3 shrink-0 rounded-full" />
              <span role="status">{alert}</span>
            </>
          ) : mission ? (
            <>
              <span className="bg-primary shrink-0 rounded-full px-2 py-0.5 text-[12px] text-white">
                목표
              </span>
              <span className="truncate">{mission.goal}</span>
            </>
          ) : collapsed ? null : (
            <>
              <span
                data-testid="guide-step"
                className="bg-block-start shrink-0 rounded-full px-2 py-0.5 text-[12px] text-white"
              >
                {step}/4
              </span>
              <span>{GUIDE_TEXT[step]}</span>
            </>
          )}
        </p>
        {mission
          ? steps.length > 0 && (
              <button
                type="button"
                aria-expanded={hintOpen}
                onClick={() => setHintOpen((open) => !open)}
                className="text-muted hover:text-ink shrink-0 cursor-pointer text-[13px] underline"
              >
                {hintOpen ? '힌트 닫기' : '힌트 보기'}
              </button>
            )
          : !alert && (
              <button
                type="button"
                aria-expanded={!collapsed}
                onClick={onToggle}
                className="text-muted hover:text-ink shrink-0 cursor-pointer text-[13px] underline"
              >
                {collapsed ? '안내 보기' : '안내 숨기기'}
              </button>
            )}
      </div>

      {mission && hintOpen && (
        <div aria-label="미션 힌트" role="group" className="flex flex-wrap items-center gap-2 pb-3">
          <ol className="flex flex-wrap items-center gap-2">
            {visibleSteps.map((label, index) => (
              <li key={`${index}-${label}`} className="scale-90">
                <GhostBlock>{label}</GhostBlock>
              </li>
            ))}
          </ol>
          {steps.length > 2 && (
            <PillButton onClick={() => setShowAll((all) => !all)}>
              {showAll ? '접기' : `더 보기 (${steps.length - 2})`}
            </PillButton>
          )}
        </div>
      )}
    </div>
  );
}

/** 첫 진입 끌어오기 손가락 — 한 번 움직이고 끝난다. 움직임 줄이기 설정이면 CSS 로 숨긴다. */
export function DragHint({ onDone }: { onDone: () => void }) {
  return (
    <span
      aria-hidden
      data-testid="drag-hint"
      onAnimationEnd={onDone}
      className="poppy-drag-hint pointer-events-none absolute top-[150px] left-[60px] z-30 text-[32px]"
    >
      👆
    </span>
  );
}
