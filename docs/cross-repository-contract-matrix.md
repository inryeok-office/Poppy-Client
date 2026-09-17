# Cross-Repository Contract Matrix

이 문서는 `Poppy-Server`의 실제 HTTP/domain 계약과 `Poppy-Client`의 API 계층을 대조한 결과다. `Poppy-agent`는 이미 Server의 internal Agent 계약을 소비하는 통합 테스트가 있으며, 이번 감사에서는 생산 코드 불일치를 발견하지 않아 수정하지 않았다.

## Contract matrix

| 영역 | Server 실제 계약 | Client 소비 계약 | 일치 여부 | 소유 저장소 / 조치 |
| --- | --- | --- | --- | --- |
| Session 생성 | `POST /api/v1/sessions`; `sessionId`, `sessionToken`, `currentBlockVersion`, `recoveryCode` | `/api/v1` 호출, credential 저장 | 일치 | Client 구현 완료 |
| Session 인증 | `X-Session-Token` header | 세션 API와 execution API에 header 주입 | 일치 | Client 구현 완료 |
| Session 복구 | `POST /api/v1/sessions/restore`; recovery code로 credential rotation | `restoreSession()`이 새 credential 저장 | 일치 | Client 구현 완료 |
| Block Revision | `POST /api/v1/sessions/{id}/block-revisions`; immutable `document`; `blockVersion` 반환 | `saveProject()`가 Server document로 변환하고 revision 생성 | 일치 | Client 구현 완료 |
| Revision 정합성 | exact `blockVersion`에 Simulation Pass가 있어야 실행 가능 | pass/execute에 현재 `blockVersion` 전달 | 일치 | Client 구현 완료 |
| Simulation Pass | `POST /api/v1/sessions/{id}/simulation-passes` with `{blockVersion}` | local safety evaluation 후 pass 기록 | 일치 | Client 구현 완료 |
| Execution 요청 | `POST /api/v1/sessions/{id}/executions` with `{blockVersion}` | raw program 대신 revision version 전송 | 일치 | Client 구현 완료 |
| Execution 상태 | `GET /api/v1/executions/{id}`; uppercase status와 lifecycle timestamps | transport DTO를 lowercase UI model로 명시적 변환 | 일치 | Client 구현 완료 |
| Cancellation | `POST /api/v1/executions/{id}/cancel`; `{executionId,status}` | 최소 cancel DTO로 처리하고 status query/SSE로 갱신 | 일치 | Client 구현 완료 |
| SSE 범위 | `GET /api/v1/sessions/{id}/events`; session token header | session stream에서 `executionId` 필터링 | 일치 | Client 구현 완료 |
| SSE frame | `event:execution-status` (optional field whitespace); JSON status data | CRLF/LF, fragmented chunks, event/data lines 처리 | 일치 | Client 구현 완료 |
| SSE terminal | `COMPLETED`, `FAILED`, `CANCELLED` frame 후 정상 종료 | terminal frame 이후 재연결 중단, EOF는 terminal 아님 | 일치 | Client 구현 완료 |
| API envelope | `{success,data,error}`; error에 `code`, `message`, `fieldErrors` | `ApiResponse`/`ApiErrorBody`에 반영 | 일치 | Client 구현 완료 |
| Missions | `GET /api/v1/missions` | 기존 UI 정적/미연결 영역 | 부분 일치 | Client 후속 Issue 후보 |
| Block metadata | `GET /api/v1/blocks` | palette에 일부 정적 catalog 존재 | 부분 일치 | Client 후속 Issue 후보 |
| Client GREET block | Server block definition에 없음 | wire 변환 시 명시적으로 거부 | 의도적 차이 | Client UI capability 정렬 후속 |
| Agent registration/delivery | bootstrap/runtime credential, robot binding, JSON-string `commandPayload`, status/recovery internal API | Agent가 existing contract와 일치 | 일치 | 변경 없음 |

## 결정 사항

- Server의 `/api/v1`와 immutable `blockVersion`을 authoritative contract로 사용한다.
- Client UI용 lowercase status와 `elapsedSec` 같은 값은 transport DTO와 분리한다. `elapsedSec`은 Server timestamps로 계산하고, Server에 없는 message는 UI에서만 표현한다.
- session token과 recovery code는 local storage/API header에만 사용하고 URL, query string, log, mock output에 넣지 않는다.
- Client-only `GREET`는 임의의 Server command로 변환하지 않는다. 사용자가 저장하려 하면 명시적으로 unsupported block으로 처리한다.
- `Missions`/`Blocks` dynamic metadata와 GREET palette 노출은 별도 UI/API follow-up이며 이번 PR의 범위를 넘는다.

## 실제 통합 검증

Client에는 `POPPY_CROSS_REPO_SERVER_URL`이 설정된 경우에만 실행되는 live contract smoke test가 있다. 이 테스트는 실제 Server에 Session → Block Revision → Simulation Pass → Execution → Status 조회 → Session Restore를 순서대로 요청한다. 기본 unit test에서는 실행되지 않으며 credential 값은 출력하지 않는다.

Agent의 existing local HTTP Mock E2E는 같은 Server contract에서 registration, allocation, status report, recovery, fencing을 별도로 검증한다. 두 검증은 실제 hardware 없이 수행하며, `Poppy-Server`/`Poppy-agent` 생산 코드를 바꾸지 않는다.

## 안전 경계

이번 정렬은 Web/API 계약만 다룬다. 실제 GO2, SportClient, DDS publisher, physical movement, physical emergency stop은 사용하지 않으며 Physical Readiness는 계속 `BLOCKED`다.
