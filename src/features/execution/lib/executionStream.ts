import { isTerminalStatus, type ExecutionState } from '../model/types';

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 5000;

/**
 * 실행 상태를 SSE(text/event-stream)로 구독한다 (명세 Execution "실행 상태 전달": "Server →
 * Web 실시간 갱신은 SSE를 사용한다"). 연결이 끊기면 지수 백오프로 재연결한다 — 서버가 재연결
 * 즉시 현재 상태부터 다시 보내므로 "연결이 끊기면 재연결 후 현재 상태를 다시 조회해 화면을
 * 복구한다"를 만족한다. 종료 상태(완료·실패·취소)를 실제로 받은 뒤에만 재연결을 멈춘다 —
 * keep-alive 제한 등으로 서버·프록시가 스트림을 그냥 EOF로 끊었을 수도 있어서, EOF 자체를
 * "끝났다"는 신호로 믿지 않는다. 404·401·403 같이 재시도해도 소용없는 응답은 곧바로 포기한다.
 *
 * 네이티브 EventSource 대신 fetch + ReadableStream 을 직접 읽는다 — 테스트 환경(jsdom)엔
 * EventSource 가 없어 폴리필 없이는 검증할 수 없고, fetch 기반이라야 MSW로 그대로 테스트할
 * 수 있다.
 *
 * @returns 구독을 끊는 함수.
 */
export function subscribeExecutionState(
  executionId: string,
  onMessage: (state: ExecutionState) => void,
): () => void {
  const controller = new AbortController();
  let stopped = false;
  let retryMs = INITIAL_RETRY_MS;

  async function connect() {
    while (!stopped) {
      let sawTerminal = false;
      try {
        const response = await fetch(`/api/executions/${executionId}/stream`, {
          signal: controller.signal,
        });
        // 4xx는 재시도해도 소용없다(존재하지 않는 실행, 인증 실패 등) — 곧바로 포기한다.
        if (response.status >= 400 && response.status < 500) return;
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
        retryMs = INITIAL_RETRY_MS; // 연결에 성공하면 백오프를 초기화한다

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          // SSE 줄바꿈은 LF·CRLF·CR 모두 허용된다 — 프레임 경계 탐색 전에 LF 로 통일한다.
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n|\r/g, '\n');

          let sepIndex: number;
          while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            try {
              const state = JSON.parse(dataLine.slice(5).trim()) as ExecutionState;
              if (isTerminalStatus(state.status)) sawTerminal = true;
              onMessage(state);
            } catch {
              // 손상된 프레임은 건너뛴다 — 다음 프레임에서 계속 이어간다
            }
          }
        }
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
      }

      // 종료 상태를 실제로 받았을 때만 멈춘다 — 그냥 EOF 였다면 재연결한다.
      if (stopped || sawTerminal) return;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
      retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    }
  }

  void connect();
  return () => {
    stopped = true;
    controller.abort();
  };
}
