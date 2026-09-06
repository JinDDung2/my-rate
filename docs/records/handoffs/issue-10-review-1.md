## Findings

**1. (CONFIRMED) 5초 타임아웃이 504가 아니라 502를 반환한다 — AC 위반**

`lib/parse-situation.ts:112-115`:
```ts
function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.name === 'TimeoutError';
}
```
라우트는 `AbortSignal.timeout(5000)`를 `client.messages.parse(params, { signal, maxRetries: 0 })`에 넘긴다. 이 시그널이 중단되면 Anthropic SDK(`@anthropic-ai/sdk@0.123.0`)는 `client.js:515/527`에서 `new Errors.APIUserAbortError()`를 던진다. 그런데 `APIUserAbortError → APIError → AnthropicError → Error` 체인 어디에서도 `this.name`을 설정하지 않으므로 `error.name === 'Error'`다 (`core/error.js:6-9,71-76` 확인). 네이티브 연결 타임아웃 경로의 `APIConnectionTimeoutError`도 동일하게 `name === 'Error'`.

결과: `isTimeoutError`가 `false`를 반환 → `parseSituation`이 `{ ok: false, error: 'upstream_error' }` → 라우트가 **502 `upstream_error`** 반환. AC "LLM 호출이 5초를 초과하면 서버가 `504`를 반환하고"를 위반한다. (클라이언트는 `res.ok`가 아니면 무조건 폴백하므로 사용자 화면 동작은 동일하지만, 서버 계약과 Verification 항목의 `504` 확인은 실패한다.)

수정 방향: SDK 에러를 `instanceof`로 판별하거나(`import { APIUserAbortError } from '@anthropic-ai/sdk'`), 라우트에서 `signal.aborted`를 직접 확인해 타임아웃을 판정.

**2. (CONFIRMED) 타임아웃 단위 테스트가 실제 SDK 에러 형태와 불일치해 위 버그를 가린다**

`lib/parse-situation.test.ts:100-107`의 "returns timeout when the llm caller aborts"는 `error.name = 'AbortError'`인 `Error`를 손으로 만들어 주입한다. 실제 라우트 경로에서 SDK가 던지는 `APIUserAbortError`는 `name === 'Error'`이므로 이 테스트는 통과하지만 프로덕션 동작을 검증하지 못한다. Verification 문서가 "abort 실패 분기" 커버를 주장하나 실제로는 커버되지 않는다.

**3. (minor) 성공 응답의 `summary`가 빈 문자열이면 요약 패널이 렌더되지 않는다**

`normalizeSituationOutput`은 `summary`가 문자열이 아니거나 trim 결과가 빈 값이면 `''`로 강제한다. `situation-input.tsx`는 `{state.summary ? (...) : null}`로 렌더하므로, 성공(200)했지만 `summary === ''`인 경우 "AI가 이렇게 이해했어요" 문구가 전혀 표시되지 않고 사용자에게 성공 피드백이 없다. AC "제출 성공 시 요약 문구가 화면에 표시된다"와 어긋난다. 시스템 프롬프트 규칙 3이 항상 요약을 요구하므로 발생 가능성은 낮음.

## Questions

- **"토스트 1회" 구현 확인 요청(핸드오프에서 명시적으로 리뷰어 확인 요청함):** `situation-input.tsx`는 단일 `role="alert"` 배너 + 닫기 버튼 + 4초 자동 소멸로 구현했고, 제출이 실패할 때마다 `setShowErrorToast(true)`로 다시 표시된다(스택되지는 않음, 항상 배너 1개). 이 동작을 "토스트 1회"로 수용하는가?
- **레이트 리밋이 업스트림 실패 요청도 카운트한다:** `route.ts`는 검증/키확인/LLM호출보다 먼저 `limiter.check()`를 호출하므로, LLM 장애로 502가 연속 발생하면 사용자의 분당 10회 예산이 그대로 소진된다. 기록 문서는 의도된 설계로 명시했다. MVP 범위에서 수용하는가?

## Test Gaps

- **라우트 핸들러(`app/api/parse-situation/route.ts`) 자동 테스트 전무.** 테스트 글롭(`lib/**/*.test.ts`) 밖이라 Content-Type 거부(400), JSON 파싱 실패(400), 키 미설정(503), 429 응답 형태/`Retry-After` 헤더, `timeout→504` / `invalid_output→502` 매핑이 모두 수동 검증에만 의존한다. 기록 문서의 수동 HTTP 검증도 샌드박스에서 정상 LLM 호출이 502로 떨어져 **200 성공 경로와 실제 504 경로를 확인하지 못했다**.
- **실제 SDK abort → 504 검증 없음** (Finding 1·2). 주입 LLM이 `APIUserAbortError` 형태를 흉내내는 테스트가 없다.
- **대표 문장 → 코드 매핑 라이브 검증 없음.** AC "`{ text: "...월급 받고 카드도..." }` → conditions에 `SALARY_TRANSFER`, `CARD_USAGE` 포함"은 가짜 LLM 단위 테스트로만 확인됐고 실제 `claude-sonnet-5` 응답으로는 미확인(기록 문서도 미완료로 명시).
- `npm test` / `npm run typecheck` / `npm run build`를 이 세션에서 실행하지 못했다(샌드박스가 명령을 거부). 신규/수정 TS 파일 정적 검토상 명백한 타입 오류는 없고, `messages.parse(params, options)` 시그니처(`resources/messages/messages.d.ts:52`)와 `output_config`/`enum: CONDITION_CODES` 패턴은 기존 `scripts/extract-conditions.ts`와 동일하므로 통과 가능성이 높다고 판단하나, 기록 문서의 "통과" 주장을 직접 재현하지는 못했다.

## Summary

핵심 골격(정규화 화이트리스트·중복제거·표준정렬, union 자동체크, 레이트 리밋, 선택 기능 격리, 사용자 입력 무로깅, 서버 전용 키, 클라이언트 번들에 SDK 미포함)은 AC를 충족하며 변경 범위도 Add/Modify 목록 안에 있고 Do Not Modify 파일은 그대로다.

다만 **타임아웃이 504가 아니라 502를 반환하는 확정 버그**(Finding 1)가 있고, 이를 검증해야 할 단위 테스트가 실제 SDK 에러 형태와 달라 버그를 가리고 있다(Finding 2). 사용자 화면 폴백 동작에는 영향이 없으나 명세의 서버 계약과 Verification의 `504` 항목을 위반하므로 병합 전 수정 권장. 그 외 라우트 핸들러 자동 테스트 부재와 라이브 LLM 매핑 미검증이 남아 있다.