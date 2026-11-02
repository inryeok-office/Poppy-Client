// 입력 정리 (명세: "입력은 공백과 제어 문자를 정리하고 100자로 자른다").
// AI 도우미에 들어가는 모든 자유 텍스트(발화문)에 적용한다 — 원격 호출 전에도 적용해
// 제어 문자가 그대로 LLM 프롬프트나 로그에 섞여 들어가지 않게 한다.

const AI_INPUT_MAX_LENGTH = 100;

/** U+0000~U+001F, U+007F (제어 문자) 를 공백으로 바꾼다. */
function stripControlChars(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    out += code <= 0x1f || code === 0x7f ? ' ' : ch;
  }
  return out;
}

export function sanitizeAiInput(raw: string): string {
  return stripControlChars(raw).replace(/\s+/g, ' ').trim().slice(0, AI_INPUT_MAX_LENGTH);
}
