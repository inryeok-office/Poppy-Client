// AI 도우미 블록 초안·힌트 계약 (소프트웨이브 신청용 틀).
//
// AiStep 은 views/experience 의 BlockNode 와 구조만 맞춘 독립 타입이다 — id 가 없고
// (적용할 때 views 쪽이 새 id 로 변환한다), 앉기(sit)를 포함하지 않는다(명세: "앉기는
// 만들지 않는다"). features 는 views 를 참조하지 않으므로 변환은 views 쪽이 맡는다.

import type { SafetyViolationCode } from '@/features/simulation';

export type AiStep =
  | { kind: 'moveForward'; distanceM: number }
  | { kind: 'move'; distanceM: number }
  | { kind: 'rotateLeft'; degrees: number }
  | { kind: 'rotateRight'; degrees: number }
  | { kind: 'wait'; seconds: number }
  | { kind: 'stop' }
  | { kind: 'standUp' }
  | { kind: 'greet' }
  | { kind: 'heart' }
  | { kind: 'dance' }
  | { kind: 'repeat'; count: number; body: AiStep[] };

/** 초안·힌트가 로컬 규칙 기반인지, 원격(Server LLM) 응답인지. */
export type AiSource = 'local' | 'remote';

export type AiProgramDraft = {
  steps: AiStep[];
  /** 아이에게 보여줄 한 줄 설명(범위를 맞춘 이유 등을 덧붙인다). */
  explanation: string;
  source: AiSource;
};

export type AiHint = {
  message: string;
  source: AiSource;
};

export type AiHintRequest = {
  /** 지금 프로그램의 실행 순서 — 서버 LLM 에 보낼 때 맥락으로 쓴다. */
  programLines: string[];
  violationCode?: SafetyViolationCode;
  violationMessage?: string;
  /** violationMessage 에서 뽑은 "N번째 블록" 의 N. */
  violationBlockNumber?: number;
};
