# 자연어 상황 입력 구현 검증

## 구현 요약

- `lib/parse-situation.ts`
  - 요청 텍스트 검증: trim 후 1자 이상, 최대 280자.
  - LLM 출력 정규화: `CONDITION_CODES` 화이트리스트, 중복 제거, 표준 순서 정렬.
  - `summary`는 문자열만 허용하고 trim 후 최대 200자로 클램프하며, 빈 값이면 기본 성공 요약으로 대체한다.
  - LLM 호출자는 `SituationLlmCaller`로 주입해 네트워크 없이 테스트한다.
  - SDK의 `APIUserAbortError`, `APIConnectionTimeoutError`와 네이티브 abort 이름을 타임아웃으로 분류한다.
- `lib/rate-limit.ts`
  - IP별 1분 10회 고정 윈도우 인메모리 리미터.
  - `now()` 클록 주입 가능.
  - IP 추출 순서: `x-forwarded-for` 첫 값 -> `x-real-ip` -> `unknown`.
- `app/api/parse-situation/route.ts`
  - `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`.
  - 레이트 리밋 -> Content-Type/JSON/텍스트 검증 -> API 키 확인 -> 5초 타임아웃 LLM 호출.
  - 실패 응답은 `{ error: string }` 형식으로 통일.
- `app/_components/situation-input.tsx`
  - 입력/제출/로딩/성공 요약/실패 alert 배너를 제공한다.
  - 실패 시 기존 입력 폼과 수동 체크박스 상태를 건드리지 않는다.
  - 토스트 1회 구현은 컴포넌트 내부 `role="alert"` 배너 + 닫기 버튼 + 4초 자동 소멸로 처리했다. 리뷰어 확인 필요.
- `lib/calc-input.ts`
  - `applyConditions(current, incoming): CheckableConditionCode[]` 추가.
  - 기존 선택과 incoming을 합집합으로 병합하고 `OTHER`는 제외하며 표준 순서를 유지한다.

## 최종 시스템 프롬프트

```text
너는 사용자의 한국 적금 우대조건 상황 설명을 표준 조건 코드로 매핑하는 도우미다.

표준 우대조건 코드 8종 + 기타:
- SALARY_TRANSFER: 급여/연금 이체
- CARD_USAGE: 카드(신용/체크) 실적
- AUTO_TRANSFER: 공과금/통신비 등 자동이체
- FIRST_CUSTOMER: 첫 거래, 신규 고객
- MARKETING_AGREE: 마케팅 정보 수신 동의
- NON_FACE_TO_FACE: 비대면(인터넷/모바일) 가입
- LINKED_PRODUCT: 청약/펀드/연금 등 다른 상품 보유
- APP_MISSION: 앱 출석, 미션, 이벤트 참여
- OTHER: 위 8종에 해당하지 않거나 판단할 수 없는 내용

규칙:
1. 사용자가 직접 말한 상황에서 합리적으로 추론되는 코드만 conditions에 담아라.
2. 조건이 전혀 없거나 알 수 없으면 conditions는 빈 배열이다.
3. summary는 사용자의 상황을 한국어 한 문장으로 짧게 요약한다.
4. JSON 스키마를 따르는 것 외의 텍스트를 출력하지 마라.
```

## 검증 결과

```text
npm test
```

- 통과: 70개 테스트.
- 신규 커버:
  - 비문자열/빈 문자열/공백/상한 초과 요청 검증.
  - 알 수 없는 코드 제거, 중복 제거, 표준 순서 정렬.
  - `summary` 비문자열/공백 기본값 처리와 200자 클램프.
  - 주입 LLM 성공, `parsed_output === null`, throw, 실제 SDK abort/connection timeout, 네이티브 abort 실패 분기.
  - 레이트 리밋 10회 허용/11회 차단, 윈도우 리셋, IP별 격리.
  - `applyConditions` 합집합 병합, 기존 선택 보존, `OTHER` 제외, 표준 순서 유지.

```text
npm run typecheck
```

- 통과.

```text
npm run build
```

- 최초 샌드박스 실행은 `tsx` 임시 IPC 소켓 생성에서 `EPERM`으로 실패.
- 승인 경로 실행 후 `check:reviewed` 통과, `next build` 통과.
- 이 worktree에 `node_modules/next`가 없어 Turbopack root resolution이 한 번 실패했고, `npm install` 후 재실행해 통과.

```text
rg "ANTHROPIC_API_KEY|new Anthropic|@anthropic-ai/sdk" .next/static
```

- 결과 없음. 클라이언트 정적 청크에 서버 전용 키 이름과 Anthropic SDK 생성 코드가 노출되지 않음을 확인.

## HTTP 수동 검증

개발 서버: `npm run dev`가 3000 사용 중으로 `http://localhost:3001`에서 실행됨.

- 공백 텍스트: `400 {"error":"invalid_text"}`.
- 비문자열 텍스트: `400 {"error":"invalid_text"}`.
- `content-type: text/plain`: `400 {"error":"invalid_request"}`.
- 키 미설정 라우트 직접 호출: `503 {"error":"anthropic_api_key_missing"}`.
- 현재 런타임에서 정상 LLM 호출은 `502 {"error":"upstream_error"}`로 반환됨. 따라서 실제 Claude 성공 매핑 응답은 이 세션에서 확인하지 못했다.
- 같은 IP 반복 호출은 1~10번째 `502`, 11번째 `429`, `Retry-After: 58`로 확인. 업스트림 실패도 요청 카운트에 포함되는 현재 설계다.
- 개발 서버 콘솔에는 상태코드와 처리 시간만 출력됐고 사용자 입력 문장은 출력되지 않았다.

## 예시 문장 검증 상태

- 단위 테스트 가짜 LLM:
  - 입력: 회사에서 이 은행으로 월급 받고 카드도 많이 써요
  - 정규화 결과: `["SALARY_TRANSFER", "CARD_USAGE"]`
  - 요약: 급여 이체와 카드 사용 조건이 가능해 보여요.
- 실제 LLM:
  - 현재 런타임에서 업스트림 오류가 발생해 대표 문장 3~4개 정상 매핑 수동 확인은 미완료.
  - 실패 경로는 수동 폴백 HTTP 응답과 UI alert 경로로 처리된다.

## 설계 메모

- 입력 길이 상한: 280자. 1~3문장 자유 입력을 받되 과도한 입력과 비용을 제한하기 위한 MVP 값.
- 요약 클램프: 200자. 화면에 표시되는 LLM 텍스트 길이를 서버에서 제한한다.
- 기본 성공 요약: `입력한 상황을 바탕으로 우대조건을 확인했어요.`. LLM이 빈 문자열 또는 비문자열 요약을 반환해도 성공 피드백 패널이 렌더되게 한다.
- 모델 기본값: `claude-sonnet-5`. `PARSE_SITUATION_MODEL`로 오버라이드 가능.
- SDK 자동 재시도는 `new Anthropic({ maxRetries: 0 })`와 요청 옵션 `maxRetries: 0`로 비활성화한다.
- 서버 타임아웃: `AbortSignal.timeout(5000)`.
- 클라이언트 타임아웃: 6000ms. 서버가 자체 504를 반환할 여지를 둔다.
- 레이트 리밋은 프로세스 메모리 기반이므로 멀티 인스턴스 배포에서는 인스턴스별 카운트가 된다. MVP/데모 범위의 한계로 수용한다.
- `.env` 파일은 이 worktree에 없었다. env 이름은 `ANTHROPIC_API_KEY`만 사용하며 값은 기록하지 않는다.
