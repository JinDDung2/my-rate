CLAUDE.md 및 관련 소스(`lib/calc-input.ts`, `lib/conditions.ts`, `lib/types.ts`, `lib/use-calc-input.ts`, `lib/ranking.ts`, `app/_components/calculator.tsx`, `condition-panel.tsx`, `situation-input.tsx`)와 diff 전체를 대조 검토했다. `npm test`/`typecheck`/`build`는 이 환경에서 승인 거부로 재실행하지 못했다(아래 참고).

## Findings

없음.

핸드오프의 Acceptance Criteria를 항목별로 검증한 결과 기준을 깨는 결함은 발견되지 않았다.

- **결정적 직렬화**: `serializeCalcInput`이 키를 `m,t,r,c` 순서로 고정하고 조건을 `CHECKABLE_CONDITION_CODES.filter(...)`로 재정렬하므로 체크 순서와 무관하게 동일 문자열. `c`는 조건 0개일 때 생략. ✅
- **역직렬화 무throw**: `parseMonthlyAmount`/`parseTermMonths`/`parseReserveType`/`normalizeConditions` 모두 null·빈문자·비숫자·범위밖·미허용·소문자·`OTHER`·중복·빈 토큰(`,,`)·`%2C`를 필드별로 독립 보정. AC의 예시 입력(`""`, `?m=&t=&r=&c=`, `?m=abc`, `?m=-100`, `?m=15000`, `?m=99999999`, `?t=9`, `?t=twelve`, `?r=X`, `?c=FOO,SALARY_TRANSFER,salary_transfer,OTHER,,CARD_USAGE,CARD_USAGE`) 전부 유효값 반환. ✅
- **월 납입액 보정 순서**: `snapMonthlyAmount` = clamp → 최근접 만원 반올림(`Math.round`) → clamp. `parseInt` 실패 시 `Number.isSafeInteger` 게이트로 기본값(500000). 설계 결정 3과 일치(`m=15000`→20000, `m=7000`→10000, `m=99999999`→1000000, `m=abc`→500000). ✅
- **필드별 보정**: `?m=abc&t=24&r=F` → `{500000, 24, 'F', []}`. ✅
- **화이트리스트/타입 좁힘**: `isTermMonths`/`isReserveType` 타입 가드로 `TermMonths`/`ReserveType` 반환. ✅
- **순수 모듈**: `lib/share-url.ts`는 `@/lib/calc-input`·`@/lib/conditions`만 import(둘 다 순수), React/Next import 없음, 모듈 최상위에서 `window`/`navigator` 참조 없음. ✅
- **하이드레이션**: 복원은 `Calculator`의 `useEffect(() => {...}, [hydrate])`에서 `window.location.search`를 읽고 `hasCalcInputQueryKeys`가 참일 때만 `hydrate` 호출. `hydrate`는 `useCallback([])`로 안정적이라 마운트 1회. render 단계에서 `window` 접근 없음. `ShareButton`도 render에서 `window` 미접근(클릭 핸들러/cleanup에서만). ✅
- **`hydrate`가 `amountText`도 `String(next.monthlyAmount)`로 재설정** → 입력창 텍스트 잔존 없음(알려진 함정 대응). ✅
- **on-demand URL**: `history.replaceState`/주소창 라이브 동기화 없음. `buildShareUrl`은 `location.search`/`hash`를 잇지 않고 새로 구성. 네트워크 호출 0건. ✅
- **클립보드 폴백**: `navigator.clipboard?.writeText` 옵셔널 체이닝 + try/catch, 실패 시 `state='fallback'` + 읽기 전용 `input`(onFocus 전체선택) 노출, `aria-live="polite"`. 성공/실패 메시지 구분. ✅
- **랭킹 동일성**: `buildRanking`은 입력의 순수 함수, `useMemo` 의존성에 `input.*` 4필드 포함. 복원 입력이 같으면 랭킹·1위 카드·`findAdvertisedLeader` 결과 자동 동일. ✅
- **계약 불변**: `useCalcInput`은 `hydrate`만 추가, 기존 반환 필드·시그니처 유지. `app/page.tsx` 서버 컴포넌트 유지. `ConditionPanel` props 미증가(`<ShareButton input={input} />`로 조립). `package.json` 불변. ✅

## Questions

1. 파라미터 이름 `m/t/r/c`는 짧지만 흔한 트래킹/라우팅 파라미터와 충돌 가능성이 있다. 특히 `?r=...`(referrer), `?c=...`(campaign), `?t=...` 등이 붙은 외부 유입 URL로 접속하면 `hasCalcInputQueryKeys`가 참이 되어 **전 필드가 기본값으로 hydrate**된다(유효하지 않은 값이므로). 설계 결정 2에서 이미 승인된 형식이고 AC의 `?utm_source=x` 케이스는 통과하지만, 배포 도메인에 캠페인 파라미터를 쓸 계획이 있다면 접두사(`ri_m` 등)나 단일 네임스페이스 키(`?s=<base64>`) 재검토가 필요한가?
2. `buildShareUrl`은 `origin`이 `http(s)://`로 시작하지 않으면 `origin`을 빈 문자열로 떨궈 **상대 URL**(`/path?query`)을 반환한다. AC 2는 "절대 URL(`origin + pathname + ?쿼리`)"을 요구한다. 배포는 https라 실질 문제는 없고 알려진 함정(`origin === "null"` 방어)에 대응한 것이지만, 이 경우 복사되는 링크가 절대 URL이 아니게 되는 동작은 의도한 것이 맞는가? (대안: `origin` 무효 시 버튼을 비활성화하거나 폴백 안내)

## Test Gaps

- **`buildShareUrl`의 비-http origin 분기 미테스트**: `origin === 'null'` / `'file://...'`일 때 상대 URL을 반환하는 동작에 대한 케이스가 `lib/share-url.test.ts`에 없다. 문서화되지 않은 동작이 조용히 회귀할 수 있다.
- **`parseInt` 관대성 미테스트**: `?m=12abc` → `parseInt('12abc',10)=12` → snap → `10000`(기본값 500000 아님). `?m=1e6` → `1` → `10000`. 설계 결정 3의 "parseInt 실패 시 기본값" 문구와 미묘하게 다른 경계이므로 명시 케이스로 고정해두는 편이 좋다. (`t`는 `Number()`라 `?t=12abc`→NaN→기본값으로, `m`과 파싱 전략이 비대칭인 점도 테스트로 드러내면 좋음.)
- **`selectedConditions` 참조 공유**: `normalizeConditions`가 `c` 부재 시 `DEFAULT_CALC_INPUT.selectedConditions` **동일 배열 참조**를 반환하고, 이것이 `hydrate` → `setInput` 상태로 들어간다. 현재 모든 조건 변경 함수(`toggleCondition`/`applyConditions`)가 새 배열을 만들어 실질 버그는 없으나(초기 `useState`도 같은 참조를 쓰므로 기존과 동일한 수준), 파서가 새 배열을 반환하도록 하고 이를 검증하는 테스트가 없다.
- **컴포넌트 레벨 자동 테스트 부재**: `Calculator`의 마운트 복원, `ShareButton`의 클립보드 성공/폴백은 RTL 미도입으로 수동 검증만(핸드오프에서 허용). Codex가 headless Chrome 스모크로 커버했다고 기록했으나 이 환경에서 재현 불가.
- **검증 재실행 불가**: 본 리뷰 환경에서 `npm test`/`npm run typecheck`/`npm run build` 실행이 승인 거부되어 독립 재확인을 못 했다. Codex 기록(81 pass, typecheck/build 통과, hydration/`useSearchParams` 경고 없음)과 코드 정적 분석상 타입·런타임 오류 징후는 없음.

## Summary

핸드오프의 모든 Acceptance Criteria와 Constraints를 충족한다. `lib/share-url.ts`는 요구대로 React/Next 비의존 순수 모듈이고, 역직렬화는 throw하지 않으며 필드별로 독립 보정하고, 직렬화는 결정적이다. `useSearchParams` 대신 마운트 `useEffect` + `window.location.search` 방식으로 하이드레이션 불일치를 피했고, URL은 "복사" 버튼에서만 on-demand 생성되며 네트워크·신규 의존성이 0이다. `hydrate`가 `amountText`까지 갱신해 입력창 텍스트 잔존 문제도 처리했다. 랭킹 재현성은 `buildRanking`이 입력의 순수 함수이므로 입력 복원만으로 보장된다.

차단 결함은 없다. 후속으로 검토할 두 가지는 (1) `m/t/r/c` 파라미터 이름의 외부 파라미터 충돌 가능성(설계 결정으로 이미 승인됨, 배포 도메인 캠페인 파라미터 계획이 있으면 재고), (2) `buildShareUrl`이 비-http origin에서 상대 URL을 반환하는 문서화되지 않은 폴백 동작이다. 둘 다 http(s) 배포 환경에서 실사용 영향은 없다.