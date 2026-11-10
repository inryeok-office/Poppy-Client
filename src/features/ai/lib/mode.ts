// AI 도우미 동작 모드 (명세: "NEXT_PUBLIC_AI_MODE = off | local(기본) | remote").
// off — AiAssistant 를 렌더하지 않는다. local — 규칙 기반 planner/hint 만 쓴다(인터넷·Server
// 없어도 동작). remote — Server LLM 을 먼저 시도하고, 실패하거나 검증에 실패하면 local 로 대신한다.

export type AiMode = 'off' | 'local' | 'remote';

export function getAiMode(): AiMode {
  const raw = process.env.NEXT_PUBLIC_AI_MODE;
  if (raw === 'off' || raw === 'remote') return raw;
  return 'local';
}
