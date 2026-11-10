# AI 도우미

체험자가 말(문장)로 블록 초안을 만들거나, 시뮬레이션이 실패했을 때 쉬운 힌트를 받는 보조
기능. 이 문서는 Client 쪽 구현 원칙과 모드, 그리고 Server(Poppy-Server)가 실제 LLM 연동을
구현할 때 지킬 계약을 정리한다.

## 원칙 (위반하면 멈춘다)

- **AI는 로봇에 명령을 보내지 않는다.** 출력은 블록 초안(JSON) 또는 힌트 문장뿐이다.
  실행 요청·명령 전송 경로에는 전혀 연결되지 않는다.
- **초안은 미리 보여주고, 사용자가 "캔버스에 넣기"를 눌러야만 반영된다.** 자동 반영은
  하지 않는다. 반영 후에는 기존 블록 변경과 똑같이 시뮬레이션 통과 기록부터 다시 거친다
  (invalidate).
- **원격 응답은 신뢰하지 않는다.** Server가 무엇을 돌려주든 `validateAiSteps`를 통과한
  블록만 쓴다. 허용 종류는 `moveForward · move(뒤로) · rotateLeft · rotateRight · wait ·
  stop · standUp · greet · heart · dance · repeat` 뿐이고, 값 범위는
  `features/simulation`의 `LIMITS`를 그대로 재사용한다. 반복 중첩·빈 반복은 금지, 블록
  수는 구조적으로 최대 12개, 모르는 필드는 버린다.
- **앉기(sit)는 만들지 않는다.** AiStep 타입 자체에 sit이 없고, 사용자가 "앉아"처럼
  요청해도 그 요청은 거부하고 안내만 남긴다.
- **입력은 정리한다.** 공백·제어 문자를 지우고 100자로 자른다(`sanitizeAiInput`).
- **LLM 키는 Client에 두지 않는다.** 브라우저는 `/api/v1/ai/*` 두 엔드포인트만 호출하고,
  실제 모델 호출·키 관리는 전부 Server가 맡는다.
- **인터넷·Server가 없어도 동작해야 한다.** 로컬 규칙 기반 planner/hint가 항상 대체
  경로다.

## 모드 — `NEXT_PUBLIC_AI_MODE`

| 값 | 동작 |
| --- | --- |
| `off` | `AiAssistant`를 렌더하지 않는다. |
| `local` (기본) | 규칙 기반 planner/hint만 쓴다. Server·인터넷 없이 동작한다. |
| `remote` | Server를 먼저 시도한다. 호출 실패나 `validateAiSteps` 검증 실패 시 조용히
  `local`로 대체한다. |

### 응답 출처 표시 (#67)

초안·힌트 아래에 어디서 만들어졌는지 한 줄로 보인다(`aiSourceLabel`).

| 상황 | `source` / `fallback` | 표시 |
| --- | --- | --- |
| Server(AI 모델) 성공 + 검증 통과 | `remote` | AI 모델이 만들었어요 |
| local 모드 | `local` | 기본 규칙으로 만들었어요 |
| remote 모드, 503·5xx·404·네트워크 오류·타임아웃 | `local` / `unavailable` | AI 서버에 연결하지 못해 기본 규칙으로 만들었어요 |
| remote 모드, 400 (`AI_INPUT_INVALID`·`AI_INPUT_REJECTED`) | `local` / `rejected` | AI가 이 문장은 받지 않아서 기본 규칙으로 만들었어요 |
| remote 모드, 200 이지만 블록·설명 검증 실패 | `local` / `invalid-response` | AI 답이 규칙에 맞지 않아 기본 규칙으로 만들었어요 |

로딩 중에는 버튼이 "만드는 중…"(힌트는 "힌트를 생각하고 있어요…")으로 바뀌고 중복 요청을
보내지 않는다. 어떤 출처든 "캔버스에 넣기"를 눌러야 반영되고, 반영 후에는 기존과 같이
시뮬레이션(안전 검증)을 다시 통과해야 실행할 수 있다.

### 출품 데모 운영 절차 (remote)

1. Poppy-Server 에 S1(`/api/v1/ai/*`)이 배포되고 추론 서비스가 떠 있는지 확인한다
   (Server 쪽 `GET {POPPY_AI_INFERENCE_URL}/health`, 또는 체험 화면에서 초안 출처가 "AI 모델"로 나오는지).
2. Vercel 프로젝트 `poppy-client` 의 Production 환경 변수 `NEXT_PUBLIC_AI_MODE=remote` 로 바꾸고
   다시 배포한다(`NEXT_PUBLIC_*` 는 빌드 때 박히므로 재배포가 필요하다).
3. 행사 중 추론 서비스가 죽어도 화면은 "AI 서버에 연결하지 못해 기본 규칙으로…"로 계속 동작한다.
   오래 걸리는 요청은 6초에서 끊고 로컬로 대신한다. 아예 끄려면 `NEXT_PUBLIC_AI_MODE=local`(또는 `off`)
   로 바꾸고 재배포한다.
4. 진행요원은 출처 문구로 지금 AI 모델이 동작 중인지 바로 구분할 수 있다.

## Server 계약

브라우저는 아래 두 엔드포인트만 호출한다 (기존 `{success, data, error}` envelope).
Server 쪽 확정 계약(오류 코드·타임아웃·503)은 Poppy-Server S1 문서(AI_API.md)를 따른다. 요약:

- 오류: 400 `AI_INPUT_INVALID`·`AI_INPUT_REJECTED`, 503 `AI_UNAVAILABLE`(추론 서비스 없음·실패·타임아웃·
  출력 검증 실패). Client 는 어느 경우든 로컬 규칙으로 대신한다.
- 타임아웃: Server S1 전체 상한 5초, Client 요청 타임아웃 6초(`AI_REQUEST_TIMEOUT_MS`).
- 힌트 요청 한도: `programLines` 최대 40줄·줄당 100자, `violationMessage` 300자. `violationCode` 는
  `exceeds-safe-zone · exceeds-time · moves-while-sitting` 만 보낸다(`invalid-values` 는 빼고 보낸다).
- `explanation`·`message` 는 1~200자. 비어 있으면 Client 는 응답 형식 오류로 보고 로컬로 대신한다.

### `POST /api/v1/ai/program-drafts`

```json
// request
{ "utterance": "네모를 그리면서 걸어 줘" }

// response (success)
{
  "success": true,
  "data": {
    "steps": [
      {
        "kind": "repeat",
        "count": 4,
        "body": [
          { "kind": "moveForward", "distanceM": 1 },
          { "kind": "rotateLeft", "degrees": 90 }
        ]
      }
    ],
    "explanation": "네모 모양으로 네 번 반복해서 움직이는 블록을 만들었어요."
  },
  "error": null
}
```

### `POST /api/v1/ai/hints`

```json
// request
{
  "programLines": ["앞으로 1m 이동", "앞으로 1m 이동", "..."],
  "violationCode": "exceeds-safe-zone",
  "violationMessage": "4번째 블록에서 안전 구역(6m×6m) 밖으로 나가요. ...",
  "violationBlockNumber": 4
}

// response (success)
{
  "success": true,
  "data": { "message": "4번째 블록에서 로봇이 안전한 공간 밖으로 나가요. 이동 거리나 방향을 줄여 볼까요?" },
  "error": null
}
```

호출이 실패하거나(네트워크, 5xx, 타임아웃) `steps`가 검증을 통과하지 못하면 Client는
조용히 `local` planner/hint로 대체한다 — Server 쪽에서 에러를 더 친절하게 꾸밀 필요는
없고, `error.message`는 로그/디버깅용으로만 쓰인다.

## Server 구현 시 지킬 것

- **구조화 출력**: LLM 응답을 자유 텍스트가 아니라 위 JSON 스키마로 강제한다(예:
  tool-call/structured output). Client가 또 한 번 `validateAiSteps`로 검증하지만,
  Server도 스키마를 벗어난 응답을 그대로 전달하지 않아야 한다.
- **입력 필터**: `utterance`도 Client와 같은 기준(제어 문자 제거, 길이 제한)으로 한 번 더
  정리한다. 길이 제한을 넘는 입력은 400으로 거부한다.
- **5초 타임아웃**: LLM 호출에 짧은 타임아웃을 두고, 넘으면 즉시 실패 응답을 돌려준다
  (Client가 바로 local로 대체할 수 있게). 체험 흐름을 LLM 응답 대기로 막으면 안 된다.
- **개인정보 저장 금지**: `utterance`·힌트 요청 내용을 로그에 남기더라도 세션 식별자·
  recovery code 등 개인 식별 가능 정보와 묶어 영구 저장하지 않는다.
