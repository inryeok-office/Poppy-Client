'use client';

import { QUICK_START_TEMPLATES, type QuickStartTemplateId } from '../model/quickStart';
import { PillButton } from '@/shared/ui';

// 캔버스 상단 — 빠른 시작 템플릿 3개(체험 시간 단축). 누르면 확인(지금 블록을 지운다는 안내) 후
// 시작~종료 사이를 템플릿으로 바꾼다. 모두 6m×6m 시뮬레이션을 통과한다(quickStart.test.ts).

type QuickStartBarProps = {
  onApply: (templateId: QuickStartTemplateId) => void;
};

export function QuickStartBar({ onApply }: QuickStartBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-8 pt-3" aria-label="빠른 시작">
      <span className="text-muted text-[13px]">빠른 시작</span>
      {QUICK_START_TEMPLATES.map((template) => (
        <PillButton
          key={template.id}
          onClick={() => {
            if (window.confirm(template.confirmMessage)) onApply(template.id);
          }}
        >
          {template.label}
        </PillButton>
      ))}
      <span className="text-muted text-[12px]">
        눌러서 시작하고, 숫자만 바꿔 나만의 프로그램을 만들어 보세요
      </span>
    </div>
  );
}
