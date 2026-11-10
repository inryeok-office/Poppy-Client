'use client';

import { useEffect, useRef, useState } from 'react';

import {
  getAiMode,
  sanitizeAiInput,
  useGenerateAiHint,
  useGenerateAiProgramDraft,
  type AiHintRequest,
  type AiProgramDraft,
} from '@/features/ai';
import { PillButton } from '@/shared/ui';

import { describeAiStep } from '../model/aiDraft';

// 오른쪽 아래 떠 있는 AI 도우미 — 로봇 미리보기(우측 패널 상단)·실행 버튼(상단 바)과
// 겹치지 않는 화면 우하단 구석에 고정한다. 명세 원칙:
//   - 로봇 명령·실행 요청은 절대 보내지 않는다. 출력은 블록 초안 또는 힌트 문장뿐.
//   - 초안은 "캔버스에 넣기"를 눌러야 반영된다(미리 보여주고 사용자가 확정).
//   - off 모드면 아예 렌더하지 않는다.

const EXAMPLES = ['네모를 그리면서 걸어 줘', '앞으로 1m 가고 왼쪽으로 돌아', '인사하고 하트 세 번'];

type AiAssistantProps = {
  /** 시뮬레이션을 통과해 실행 화면으로 바뀌면 true — 그 화면에서는 숨긴다. */
  hideForRun: boolean;
  /** 시뮬레이션이 막 실패했을 때만 힌트 섹션을 보여준다. 실패가 바뀌면 새로 받는다. */
  hintRequest: AiHintRequest | null;
  onApplyDraft: (draft: AiProgramDraft) => void;
};

export function AiAssistant({ hideForRun, hintRequest, onApplyDraft }: AiAssistantProps) {
  const mode = getAiMode();
  const [open, setOpen] = useState(false);
  const [utterance, setUtterance] = useState('');
  const [draft, setDraft] = useState<AiProgramDraft | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const draftMutation = useGenerateAiProgramDraft();
  const hintMutation = useGenerateAiHint();
  const lastHintKey = useRef<string | null>(null);

  // 실패 내용(코드·문구)이 바뀌면 그 실패에 대한 새 힌트를 받는다. 같은 실패가 그대로면
  // 다시 요청하지 않는다(이미 받은 힌트를 그대로 보여준다).
  useEffect(() => {
    if (!hintRequest) {
      lastHintKey.current = null;
      return;
    }
    const key = `${hintRequest.violationCode ?? ''}:${hintRequest.violationMessage ?? ''}`;
    if (key === lastHintKey.current) return;
    lastHintKey.current = key;
    hintMutation.mutate(hintRequest);
    // hintMutation 은 매 렌더 새 참조라 의존성에 넣지 않는다 — key 만 보고 중복 요청을 막는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hintRequest]);

  if (mode === 'off' || hideForRun) return null;

  const makeDraft = () => {
    const clean = sanitizeAiInput(utterance);
    if (clean.length === 0) return;
    setNotice(null);
    setDraft(null);
    draftMutation.mutate(clean, {
      onSuccess: (result) => setDraft(result),
      onError: (error) => setNotice(error instanceof Error ? error.message : '다시 말해 볼래요?'),
    });
  };

  const applyDraft = () => {
    if (!draft) return;
    onApplyDraft(draft);
    setDraft(null);
    setUtterance('');
  };

  return (
    <div className="fixed right-6 bottom-6 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          className="border-line bg-card flex w-[320px] flex-col gap-3 rounded-xl border p-4 shadow-lg"
          role="dialog"
          aria-label="AI 도우미"
        >
          <p className="text-ink text-[15px]">말로 만들기</p>

          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setUtterance(example)}
                className="border-line text-muted hover:bg-page cursor-pointer rounded-full border px-2.5 py-1 text-[12px]"
              >
                {example}
              </button>
            ))}
          </div>

          <input
            value={utterance}
            onChange={(event) => setUtterance(event.target.value)}
            placeholder="예: 네모를 그리면서 걸어 줘"
            maxLength={100}
            aria-label="말로 블록 만들기 입력"
            className="border-line bg-page text-ink rounded-lg border px-3 py-2 text-[14px] outline-none"
          />

          <PillButton
            variant="primary"
            onClick={makeDraft}
            aria-disabled={draftMutation.isPending || undefined}
          >
            {draftMutation.isPending ? '만드는 중…' : '블록으로 만들기'}
          </PillButton>

          {notice && <p className="text-danger text-[13px]">{notice}</p>}

          {draft && (
            <div className="border-line bg-page flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-ink text-[13px]">{draft.explanation}</p>
              <ol className="text-muted flex flex-col gap-1 text-[13px]">
                {draft.steps.map((step, index) => (
                  <li key={index}>{describeAiStep(step)}</li>
                ))}
              </ol>
              <p className="text-muted text-[12px]">넣으면 지금 블록이 바뀌어요</p>
              <div className="flex gap-2">
                <PillButton variant="primary" onClick={applyDraft}>
                  캔버스에 넣기
                </PillButton>
                <PillButton onClick={() => setDraft(null)}>다시 만들기</PillButton>
              </div>
            </div>
          )}

          {hintRequest && (hintMutation.data || hintMutation.isPending) && (
            <div className="border-line bg-page rounded-lg border p-3" aria-live="polite">
              <p className="text-ink text-[13px]">
                {hintMutation.isPending ? '힌트를 생각하고 있어요…' : hintMutation.data?.message}
              </p>
            </div>
          )}
        </div>
      )}

      <PillButton
        variant="primary"
        onClick={() => setOpen((value) => !value)}
        className="shadow-lg"
        aria-expanded={open}
      >
        AI 도우미
      </PillButton>
    </div>
  );
}
