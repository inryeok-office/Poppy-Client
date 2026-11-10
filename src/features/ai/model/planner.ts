// 규칙 기반 planner — 한국어 발화문을 AiStep[] 로 바꾼다. 인터넷·Server 없이도 동작해야
// 해서(명세) LLM 을 쓰지 않고 정규식 + 키워드 매칭만 쓴다. remote 모드가 꺼져 있거나
// 실패해도 이 planner 가 항상 대신할 수 있어야 한다.
//
// 조각 나누기: 쉼표, '그리고', '다음에' 에서 나눈다. 소수점(0.5)은 '.' 이라 이 구분자들과
// 겹치지 않는다. 한 조각 안에 "이동 + 다른 동작"이 붙어 있을 수 있어(예: "0.5m 가고
// 하트 세 번"), 조각마다 먼저 이동 패턴을 떼어내고 나머지를 이어서 읽는다. "N번"/"세 번"은
// 그 뒤(또는 그 조각)의 동작만 반복으로 감싼다.

import { LIMITS } from '@/features/simulation';

import type { AiStep } from './types';

export type PlanResult =
  { ok: true; draft: { steps: AiStep[]; explanation: string } } | { ok: false; reason: string };

const UNRECOGNIZED_REASON = '‘앞으로 1m 가고 왼쪽으로 돌아’처럼 말해 볼래요?';

const KOREAN_COUNT_WORD: Record<string, number> = {
  한: 1,
  두: 2,
  세: 3,
  네: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  열: 10,
};

function clampNumber(
  value: number,
  range: { min: number; max: number; step?: number },
): { value: number; clamped: boolean } {
  let v = value;
  let clamped = false;
  if (v < range.min) {
    v = range.min;
    clamped = true;
  }
  if (v > range.max) {
    v = range.max;
    clamped = true;
  }
  if (range.step !== undefined) {
    const rounded = Number((Math.round(v / range.step) * range.step).toFixed(6));
    if (Math.abs(rounded - v) > 1e-9) clamped = true;
    v = rounded;
  } else {
    const rounded = Math.round(v);
    if (rounded !== v) clamped = true;
    v = rounded;
  }
  return { value: v, clamped };
}

function splitSegments(text: string): string[] {
  return text
    .split(/,|그리고|다음에/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function extractRepeatCount(segment: string): { count: number | null; rest: string } {
  const digitMatch = segment.match(/(\d+)\s*번/);
  if (digitMatch) {
    return { count: Number(digitMatch[1]), rest: segment.replace(digitMatch[0], '').trim() };
  }
  const wordMatch = segment.match(/(한|두|세|네|다섯|여섯|일곱|여덟|아홉|열)\s*번/);
  if (wordMatch) {
    return {
      count: KOREAN_COUNT_WORD[wordMatch[1]],
      rest: segment.replace(wordMatch[0], '').trim(),
    };
  }
  return { count: null, rest: segment };
}

type ParsedAction = { steps: AiStep[]; notes: string[] };

function parseShape(segment: string): ParsedAction | null {
  if (/네모/.test(segment)) {
    return {
      steps: [
        {
          kind: 'repeat',
          count: 4,
          body: [
            { kind: 'moveForward', distanceM: 1 },
            { kind: 'rotateLeft', degrees: 90 },
          ],
        },
      ],
      notes: [],
    };
  }
  if (/세모/.test(segment)) {
    return {
      steps: [
        {
          kind: 'repeat',
          count: 3,
          body: [
            { kind: 'moveForward', distanceM: 1 },
            { kind: 'rotateLeft', degrees: 120 },
          ],
        },
      ],
      notes: [],
    };
  }
  if (/반\s*바퀴/.test(segment)) {
    return { steps: [{ kind: 'rotateRight', degrees: 180 }], notes: [] };
  }
  if (/한\s*바퀴/.test(segment)) {
    return {
      steps: [{ kind: 'repeat', count: 4, body: [{ kind: 'rotateRight', degrees: 90 }] }],
      notes: [],
    };
  }
  return null;
}

function buildMoveStep(match: RegExpMatchArray): ParsedAction {
  const dirWord = match[1] ?? '앞으로';
  let meters = Number(match[2]);
  const unit = match[3];
  if (unit === 'cm') meters /= 100;
  if (unit === '칸') meters *= 0.5;
  const { value, clamped } = clampNumber(meters, LIMITS.moveDistance);
  const kind: 'moveForward' | 'move' = dirWord === '뒤로' ? 'move' : 'moveForward';
  const notes = clamped ? [`${dirWord} 이동 거리를 ${value}m로 맞췄어요.`] : [];
  return { steps: [{ kind, distanceM: value }], notes };
}

function parseRotate(segment: string): ParsedAction | null {
  const match = segment.match(/(왼쪽|오른쪽)(?:으로)?\s*(?:([\d.]+)\s*(?:도|°))?/);
  if (!match) return null;
  const [, dirWord, numStr] = match;
  const degrees = numStr ? Number(numStr) : 90;
  const { value, clamped } = clampNumber(degrees, LIMITS.rotateDegree);
  const kind: 'rotateLeft' | 'rotateRight' = dirWord === '왼쪽' ? 'rotateLeft' : 'rotateRight';
  const notes = clamped ? [`회전 각도를 ${value}°로 맞췄어요.`] : [];
  return { steps: [{ kind, degrees: value }], notes };
}

function parseWait(segment: string): ParsedAction | null {
  const match = segment.match(/([\d.]+)\s*초\s*(?:동안\s*)?기다/);
  if (!match) return null;
  const { value, clamped } = clampNumber(Number(match[1]), LIMITS.waitSeconds);
  const notes = clamped ? [`기다리는 시간을 ${value}초로 맞췄어요.`] : [];
  return { steps: [{ kind: 'wait', seconds: value }], notes };
}

function parseSimpleAction(segment: string): ParsedAction | null {
  if (/인사/.test(segment)) return { steps: [{ kind: 'greet' }], notes: [] };
  if (/하트/.test(segment)) return { steps: [{ kind: 'heart' }], notes: [] };
  if (/춤/.test(segment)) return { steps: [{ kind: 'dance' }], notes: [] };
  if (/일어서/.test(segment)) return { steps: [{ kind: 'standUp' }], notes: [] };
  if (/(멈춰|정지)/.test(segment)) return { steps: [{ kind: 'stop' }], notes: [] };
  return null;
}

type SegmentResult = { steps: AiStep[]; notes: string[]; understood: boolean };

const NOT_UNDERSTOOD: SegmentResult = { steps: [], notes: [], understood: false };

/** 이동 패턴이 없는 나머지 부분(또는 조각 전체) — 모양·회전·대기·동작 중 하나 + "N번" 반복. */
function parseSingleAction(text: string): SegmentResult {
  if (/앉/.test(text)) {
    return { steps: [], notes: ['지금은 앉기 동작을 만들 수 없어요.'], understood: true };
  }
  const { count, rest } = extractRepeatCount(text);
  const target = rest.length > 0 ? rest : text;
  const parsed =
    parseShape(target) ?? parseRotate(target) ?? parseWait(target) ?? parseSimpleAction(target);
  if (!parsed) return NOT_UNDERSTOOD;

  const hasNestedRepeat = parsed.steps.some((step) => step.kind === 'repeat');
  if (count === null) return { steps: parsed.steps, notes: parsed.notes, understood: true };
  if (hasNestedRepeat) {
    return {
      steps: parsed.steps,
      notes: [...parsed.notes, '반복 안에는 반복을 넣을 수 없어서 바깥 반복은 적용하지 않았어요.'],
      understood: true,
    };
  }
  const { value: repeatCount, clamped } = clampNumber(count, LIMITS.repeatCount);
  const notes = clamped
    ? [...parsed.notes, `반복 횟수를 ${repeatCount}번으로 맞췄어요.`]
    : parsed.notes;
  return {
    steps: [{ kind: 'repeat', count: repeatCount, body: parsed.steps }],
    notes,
    understood: true,
  };
}

/** 조각 하나 — 앞에 이동 패턴이 있으면 떼어내고, 남은 글자를 이어서 읽는다. */
function parseSegment(segment: string): SegmentResult {
  const moveMatch = segment.match(/(?:(앞으로|뒤로)\s*)?([\d.]+)\s*(cm|m|칸)/);
  if (moveMatch && moveMatch.index !== undefined) {
    const moveStep = buildMoveStep(moveMatch);
    const remainder = segment.slice(moveMatch.index + moveMatch[0].length).trim();
    const rest = remainder.length > 0 ? parseSingleAction(remainder) : NOT_UNDERSTOOD;
    return {
      steps: [...moveStep.steps, ...rest.steps],
      notes: [...moveStep.notes, ...rest.notes],
      understood: true,
    };
  }
  return parseSingleAction(segment);
}

export function planFromUtterance(utterance: string): PlanResult {
  const segments = splitSegments(utterance);
  if (segments.length === 0) return { ok: false, reason: UNRECOGNIZED_REASON };

  const steps: AiStep[] = [];
  const notes: string[] = [];
  let understoodAny = false;

  for (const segment of segments) {
    const result = parseSegment(segment);
    if (result.understood) understoodAny = true;
    steps.push(...result.steps);
    notes.push(...result.notes);
  }

  if (!understoodAny || steps.length === 0) return { ok: false, reason: UNRECOGNIZED_REASON };

  const explanation = notes.length > 0 ? notes.join(' ') : '말한 대로 블록을 만들었어요.';
  return { ok: true, draft: { steps, explanation } };
}
