import type { ExecutionState } from '../model/types';

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 5000;

/**
 * 실행 상태를 SSE(text/event-stream)로 구독한다 (명세 Execution "실행 상태 전달": "Server →
 * Web 실시간 갱신은 SSE를 사용한다"). 연결이 끊기면 지수 백오프로 재연결한다 — 서버가 재연결
 * 즉시 현재 상태부터 다시 보내므로 "연결이 끊기면 재연결 후 현재 상태를 다시 조회해 화면을
 * 복구한다"를 만족한다. 서버가 종료 상태(완료·실패·취소)에서 스트림을 닫으면 재연결하지 않는다.
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
      try {
        const response = await fetch(`/api/executions/${executionId}/stream`, {
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
        retryMs = INITIAL_RETRY_MS; // 연결에 성공하면 백오프를 초기화한다

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) return; // 서버가 종료 상태에서 정상 종료 — 재연결하지 않는다
          buffer += decoder.decode(value, { stream: true });

          let sepIndex: number;
          while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            const dataLine = frame.split('\n').find((line) => line.startsWith('data:'));
            if (!dataLine) continue;
            try {
              onMessage(JSON.parse(dataLine.slice(5).trim()) as ExecutionState);
            } catch {
              // 손상된 프레임은 건너뛴다 — 다음 프레임에서 계속 이어간다
            }
          }
        }
        return;
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
        await new Promise((resolve) => setTimeout(resolve, retryMs));
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      }
    }
  }

  void connect();
  return () => {
    stopped = true;
    controller.abort();
  };
}
