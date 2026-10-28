# Poppy-Client

POPPY 서비스의 프론트엔드 저장소입니다. 백엔드는 [Poppy-Server](https://github.com/inryeok-office/Poppy-Server)에 있습니다.

블록 코딩으로 로봇의 동작을 구성하고, 시뮬레이션을 통과한 뒤 실제 로봇에서 실행하는 행사장 체험 서비스의 웹 클라이언트입니다.

## 로컬 실행

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL 설정
npm run dev
```

Node는 `.nvmrc`에 고정되어 있고 패키지 매니저는 **npm**입니다. `pnpm`이나 `yarn`으로 설치하면 락파일이 갈라지므로 사용하지 않습니다.

| 명령 | 용도 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` / `npm run start` | 프로덕션 빌드 / 실행 |
| `npm run typecheck` | 타입 검사 |
| `npm run lint` / `npm run lint:fix` | 린트 |
| `npm run format` / `npm run format:check` | 포맷 |
| `npm run test` / `npm run test:watch` | 테스트 |
| `npm run verify` | 타입 → 린트 → 테스트 → 빌드 한 번에 |

PR을 올리기 전에 `npm run verify`를 실행하세요. CI(`.github/workflows/ci.yml`)도 같은 단계에 `format:check`를 추가해 검증합니다.

## 공용 PC 체험 기록 정책

행사장 PC 는 여러 체험자가 이어서 쓰므로, 브라우저(localStorage)에 남는 블록 초안·세션 credential 을
다음 체험자가 이어받지 않게 한다 (`src/features/session/lib/experienceLifecycle.ts`).

- **새 체험 시작**: 인트로의 `체험하러 가기`·`미션 골라서 도전하기`, 체험 화면의 `처음으로`, 실행 결과의
  `다음 체험자 시작` 은 초안·세션 ID·credential·미션 선택을 모두 지운다. 이어하기는 인트로의 **복구 코드**로만 한다.
- **자동 만료**: 마지막 활동(블록 저장·체험 화면 진입) 후 `EXPERIENCE_IDLE_TIMEOUT_MS` = **15분**이 지나면 다음
  진입 때 기록을 버리고 새 세션으로 시작한다. 활동 시각 없이 남은 이전 버전 기록도 같이 버린다.
- **새로고침 보존**: 15분 안의 새로고침(F5)은 같은 체험으로 보고 블록을 그대로 복원한다.
- **세션 확인**: 저장된 세션은 진입 때 `GET /api/v1/sessions/{id}` 로 확인한다. 401·404·410 이거나 `EXPIRED`
  면 조용히 지우고 새 세션을 만든다(같은 체험의 초안은 새 세션에 저장). 네트워크 오류면 저장된 세션을 그대로 쓴다.

## 기술 스택

- **핵심**: Next.js (App Router) · TypeScript · Tailwind CSS · TanStack Query · axios · FSD
- **테스트/품질/CI**: Vitest · jsdom · React Testing Library · MSW · ESLint · Prettier · GitHub Actions
- **도입 시**(필요해질 때 팀 합의 후 설치): shadcn/ui(공통 UI) · nuqs(URL 필터) · React Hook Form + Zod(폼) · Zustand(전역 클라이언트 상태)

정확한 버전은 `package.json` / `package-lock.json`을 기준으로 합니다.

## 폴더 구조 (FSD)

```text
src/
├── app/       # Next 라우트 + 전역 설정 (layout, providers, globals.css)
├── views/     # 페이지 조합 (Next app/ 라우팅과 이름 충돌 → views 사용)
├── widgets/   # 독립적인 큰 UI 블록
├── features/  # 사용자 행동 (버튼 클릭으로 시작되는 동작 단위)
├── entities/  # 도메인 모델
└── shared/    # 공통 UI, 유틸, API 클라이언트
    ├── api/   # axios 인스턴스 (유일한 HTTP 진입점) + MSW 목 서버
    ├── ui/    # 공통 UI 컴포넌트
    └── lib/   # 공통 유틸
```

- import는 **상위 → 하위 방향만** 가능합니다. (`app → views → widgets → features → entities → shared`)
- 슬라이스는 `index.ts`(Public API)로만 외부에 노출합니다. 내부 파일 직접 import는 금지합니다.
- `views` · `widgets` · `features` · `entities` · `shared/ui` · `shared/lib`은 아직 비어 있습니다(`.gitkeep`만 있음). 첫 기능을 만들 때 해당 레이어에 슬라이스를 추가하세요.
- TanStack Query Provider는 `src/app/providers.tsx`에 있고 `layout.tsx`에 이미 연결되어 있습니다. `QueryClient`를 새로 만들지 마세요.
- HTTP 요청은 `shared/api`의 axios 인스턴스(`api`) 하나로 통일합니다. 컴포넌트에서 axios를 직접 호출하지 않고 도메인 `api` 훅(`useQuery` / `useMutation`)을 통합니다.

## 테스트

- Vitest + jsdom + React Testing Library로 컴포넌트/유닛 테스트를 작성합니다.
- API 호출이 있는 코드는 실제 서버 대신 MSW로 목 응답을 만듭니다. 핸들러는 `src/shared/api/msw/handlers.ts`에 모으고, 도메인 슬라이스가 생기면 그 슬라이스의 핸들러를 여기서 합칩니다.
- `vitest.setup.ts`가 MSW 서버 생명주기(listen/resetHandlers/close)와 테스트 간 DOM 정리를 담당합니다. 정의되지 않은 요청은 `onUnhandledRequest: 'error'`로 즉시 실패해 놓친 Mock을 바로 드러냅니다.
- 예시는 `src/shared/api/axiosInstance.test.ts`, `src/app/providers.test.tsx`를 참고하세요.

## 네이밍

- 컴포넌트 파일 `PascalCase.tsx`, 그 외 `camelCase.ts`, 슬라이스 폴더 `kebab-case`
- 컴포넌트 `PascalCase` · 함수/변수 `camelCase` · 상수 `UPPER_SNAKE_CASE` · 훅 `useXxx`
- Boolean은 `is` / `has` / `can`, 핸들러는 `handleXxx`, props 콜백은 `onXxx`

## 하지 말 것

- FSD 레이어 규칙 위반 (하위가 상위 import)
- Public API 없이 슬라이스 내부 직접 import
- 서버 상태를 전역 스토어에 중복 저장
- 컴포넌트에서 axios 직접 호출 (도메인 api 훅을 거치지 않고)
- `any` 남용, `console.log` 방치 (ESLint가 막습니다)
- 비밀 정보를 코드나 `NEXT_PUBLIC_` 변수에 노출
