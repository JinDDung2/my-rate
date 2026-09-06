## Findings

**1. (중간) 서버 5초 타임아웃 → 504 경로가 실제 SDK로 한 번도 검증되지 않았고, `client.messages.parse`가 2번째 인자(`RequestOptions`)를 존중하는지에 전적으로 의존한다.**
- `app/api/parse-situation/route.ts:70-83` — 기존 패턴(`scripts/extract-conditions.ts:95-101`)은 `client.messages.parse({...})`를 **인자 1개**로만 호출한다. 이 라우트는 `parse(body, { signal, maxRetries: 0 })` 형태로 2번째 인자를 새로 도입했다.
- 만약 이 SDK 버전(`^0.123.0`)의 `.parse()`가 2번째 인자를 무시하면 `AbortSignal.timeout(5000)`이 요청에 연결되지 않고, 서버는 SDK 기본 타임아웃(수 분)까지 대기한다. 이 경우 AC "LLM 호출이 5초를 초과하면 서버가 `504`를 반환" 이 깨진다(클라이언트는 6초에 abort하므로 사용자 폴백 자체는 유지됨).
- 검증 기록에서도 실제 호출은 전부 `502 upstream_error`로 떨어졌다고 명시 — **timeout(504) 분기는 실제 SDK 예외로 확인된 바 없다.** `parseSituation`의 유닛 테스트는 주입 caller에 직접 `APIUserAbortError`를 throw하는 것이라 이 배선을 커버하지 못한다.
- 실패 시나리오: `.parse()`가 options 인자를 드롭 → LLM이 20초 응답 → 서버가 20초간 커넥션 점유, `504` 대신 결국 `502`/기타. AC의 "서버 504" 미충족.

**2. (낮음) 인메모리 레이트 리미터의 `windows` Map이 무제한 증가한다.**
- `lib/rate-limit.ts:12` — 만료된 윈도우 엔트리를 제거하는 경로가 없다. 동일 키 재요청 시에만 덮어써진다. 서로 다른 IP가 누적되면 프로세스 수명 동안 메모리가 단조 증가한다.
- 기록 문서에는 "멀티 인스턴스 인스턴스별 카운트" 한계만 적혀 있고 이 누수는 문서화되지 않았다. AC(10회 허용/11회 차단)는 충족하므로 차단 사유는 아니나, 정리 로직 또는 문서 명시가 필요하다.

**3. (낮음) `lib/parse-situation.ts:1`이 `@anthropic-ai/sdk`에서 `APIUserAbortError` / `APIConnectionTimeoutError`를 런타임 값으로 import한다.**
- 핸드오프 제약은 "`@anthropic-ai/sdk` **타입 import**는 허용"이라고 명시. 값 import는 순수 모듈에 SDK 루트 모듈 전체를 로드시킨다.
- 기능상 안전하다(클라이언트 번들 미포함 확인됨, `isTimeoutError`의 `error.name` 폴백이 `AbortError`/`TimeoutError`를 이미 커버하므로 값 import 없이도 분류 가능). 제약 문구와의 편차이므로 `error.name`/`error.status` 매칭만으로 대체하거나, 이 편차를 기록 문서에 명시할 것.

**4. (정보) 에러 상태코드 매핑이 핸드오프와 다르다.**
- 핸드오프: "업스트림 오류 `502`, 키 없음 `503`, 기타 `500`". 구현은 `500`을 전혀 반환하지 않고 `invalid_output` → `502 invalid_llm_output`, 그 외 비-timeout → `502 upstream_error`로 통일.
- 클라이언트가 `res.ok`만 보고 이유를 구분하지 않으므로 기능 영향 없음. 의도된 단순화라면 기록 문서에 남길 것.

## Questions

- `@anthropic-ai/sdk@^0.123.0`의 `client.messages.parse(body, options)` 시그니처에서 `options.signal` / `options.maxRetries`가 실제로 요청에 반영되는가? (Finding 1) 실제 키로 dev 서버를 띄워 서버 타임아웃을 100ms로 낮춰 `504`가 나오는지 확인 필요 — 기록의 Verification 계획에도 있으나 미수행 상태.
- 실제 Claude 호출로 대표 문장(급여+카드 등)이 `SALARY_TRANSFER`, `CARD_USAGE`를 반환하는지 미확인. AC 1번 항목이 실측되지 않았다(sandbox 네트워크 차단). 배포 전 1회 수동 확인 필요.
- `npm run build`가 이 worktree에서 `npm install` 이후에야 통과했다. CI/배포 환경에서 `node_modules/next` 존재가 보장되는가?
- 토스트: 로딩 중 textarea/버튼이 `disabled`라 이중 제출이 UI로는 불가능하다. 그렇다면 `handleSubmit`의 `requestRef.current?.abort()` 및 언마운트 abort 시 이전 요청의 `catch`가 `setShowErrorToast(true)`를 호출하는 경로는 사실상 도달 불가 — 의도한 방어 코드로 남겨두는 게 맞는가, 아니면 `.then`/`.catch`를 `requestRef.current === controller`로 게이팅할 것인가?

## Test Gaps

- **라우트 핸들러(`app/api/parse-situation/route.ts`) 자체에 대한 테스트가 전혀 없다.** 러너 글롭 밖이라 수동 검증 대상이나, 그 수동 검증(실제 LLM 성공 매핑, 실제 5초→504)이 기록상 미완료다. 핵심 통합 지점이 자동/수동 모두 미검증.
- `parseSituation`가 주입된 `options.signal`을 caller로 그대로 전달하는지 확인하는 테스트 없음 (Finding 1의 순수 모듈 측면).
- `normalizeSituationOutput`: `conditions` 배열에 문자열이 아닌 원소(숫자/객체/null)가 섞인 케이스 미테스트 — 코드는 `typeof value !== 'string'` 로 걸러내나 회귀 방지 커버리지 없음.
- 레이트 리밋: 차단된 요청이 카운터를 추가로 증가시키지 않고 윈도우 시작 시각을 연장하지 않는다는 불변식 미테스트.
- `getClientIp`: `x-forwarded-for`가 빈 문자열/공백/`","`만 있는 경우 `x-real-ip`로 폴백하는지 미테스트(부분 커버).
- 클라이언트 컴포넌트(`situation-input.tsx`) 테스트 없음 — 저장소에 RTL 미도입이라 관행상 수용 가능하나, "성공 시 요약 표시 / 실패 시 폼 불변 + 토스트 1회 / 자동 체크 union" AC는 수동 확인에만 의존.

## Summary

AC의 순수 로직 부분(요청 검증, 출력 정규화/화이트리스트/중복 제거/표준 순서, union 적용, 레이트 리밋 10/11 경계, 클라이언트 조용한 폴백, 서버 로그에 `text` 미노출, 클라이언트 번들에 키·SDK 미포함, 순수 모듈 React/Next 미의존)은 코드상 충족되며 유닛 테스트로 뒷받침된다. 구조·격리·스타일도 핸드오프 제약을 따른다.

차단성 결함은 없으나, **실제 Anthropic SDK를 통한 성공 매핑과 5초→504 타임아웃 경로가 한 번도 실행 검증되지 않았고**(Finding 1), 504가 `client.messages.parse`의 2번째 인자 존중 여부에 의존한다는 점이 가장 큰 위험이다. 배포 전 실제 키로 (a) 대표 문장 매핑, (b) 인위적 서버 타임아웃 → `504` 두 가지를 수동 확인해야 AC를 실질적으로 만족한다고 볼 수 있다. 그 외 레이트 리미터 메모리 누수와 SDK 에러 클래스 값 import는 경미한 정리 사항이다.