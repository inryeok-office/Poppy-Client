import { sessionAuthHeaders } from '@/shared/api';

import { mapSseState } from '../api/executionApi';
import { isTerminalStatus, type ExecutionSseEventDto, type ExecutionState } from '../model/types';

const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 5000;

export function subscribeExecutionState(
  sessionId: string,
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
        const response = await fetch(`/api/v1/sessions/${sessionId}/events`, {
          headers: sessionAuthHeaders(sessionId),
          signal: controller.signal,
        });
        if (response.status >= 400 && response.status < 500) return;
        if (!response.ok || !response.body) throw new Error(`stream ${response.status}`);
        retryMs = INITIAL_RETRY_MS;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n|\r/g, '\n');

          let sepIndex: number;
          while ((sepIndex = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, sepIndex);
            buffer = buffer.slice(sepIndex + 2);
            const eventLine = frame.split('\n').find((line) => line.startsWith('event:'));
            if (eventLine && eventLine.slice(6).trim() !== 'execution-status') continue;
            const data = frame
              .split('\n')
              .filter((line) => line.startsWith('data:'))
              .map((line) => line.slice(5).trim())
              .join('\n');
            if (!data) continue;
            try {
              const event = JSON.parse(data) as ExecutionSseEventDto;
              if (event.executionId !== executionId) continue;
              const state = mapSseState(event);
              if (isTerminalStatus(state.status)) sawTerminal = true;
              onMessage(state);
            } catch {
              // Ignore malformed individual frames; the next valid frame remains usable.
            }
          }
        }
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === 'AbortError')) return;
      }

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
