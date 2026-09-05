## Findings

**F1 (중): 핸드오프 Verification 3~7이 실행·기록되지 않았다.**
리포트에 남은 검증은 `typecheck`, `build`, 순수 함수 스니펫뿐이다. 브라우저에서만 확인 가능한 AC — 입력 즉시 갱신(제출 없음), 390px 1열 레이아웃/터치 타깃, Tab만으로 금액→기간→적립방식→체크박스 8종 도달, 입력 변경 시 네트워크 요청 0건, `OTHER` 항목에 활성 체크박스 입력 없음 — 이 다섯 개가 미검증 상태다. 이슈 #1에서는 Chrome DevTools Protocol로 UI를 실제로 구동해 기록했으므로(`docs/records/2026-09-05-product-data-load-decisions.md`) 동일 수준을 요구한다. 코드를 읽어 반증은 찾지 못했지만(신규 코드에 `fetch` 없음, `useProducts`의 effect deps가 `[requestId]`라 리렌더로 재요청되지 않음, `min-h-12`=3rem·`has-[:checked]`·`sr-only`가 Tailwind 3.4.19에서 정상 생성됨을 확인), 정적 확인은 AC의 "DevTools에서 확인"을 대체하지 않는다.

**F2 (중): 리포트 필수 기재 항목 4개 중 3개가 빠졌다.**
핸드오프는 ①콤마 포맷을 입력창 안/밖 중 어디에 적용했는지 ②다르게 간 설계 결정과 이유 ③`OTHER` 렌더 방식 ④임시 출력에 매칭 상품 건수를 넣었는지를 리포트에 남기라고 명시했다. 이번 요약에는 ②의 일부(라벨 단일화, 배지 문구 변경)만 있고 ①③④가 없다. 코드상으로는 ①입력창 밖 보조 표기(`condition-panel.tsx:96-97`)와 요약 섹션, ③안내 행 + `선택 불가` 배지, ④미포함으로 읽히지만, 이건 리뷰어가 코드를 읽어 복원한 것이지 보고된 게 아니다.

**F3 (하): `ProductList`의 h1→h2 변경으로 제목 계층이 평평해졌다.**
`app/_components/product-list.tsx:64`의 섹션 제목이 h2가 됐는데 상품명도 h2다(`:17`). 변경 전에는 h1(섹션) > h2(상품명)로 중첩이 맞았고, 지금은 43개 상품명이 섹션 제목과 동급으로 나열된다. 페이지 h1을 `app/page.tsx`로 올린 방향 자체는 옳으니, 상품명을 h3로 내리면 해결된다. 아울러 이 파일 수정은 Constraint 11("기존 `ProductList` 동작을 바꾸지 않는다")의 경계에 있다 — 정당한 변경이라고 보지만 리포트에 언급이 없다.

**F4 (하): 앞뒤 공백이 붙은 붙여넣기 입력이 "숫자 아님"으로 거부된다.**
`lib/calc-input.ts:37`은 공백 판정에만 `trim()`을 쓰고 `:41`의 정규식은 원문에 건다. 그래서 `" 500000"`, `"500000 "`(다른 화면에서 금액을 복사해 붙여넣는 흔한 경로)가 `not-a-number`로 떨어진다. 확인함: `" 500000"` → `not-a-number`, `"500,000"` → 유효. 핸드오프의 "공백을 파싱 전에 걸러낼 것"은 거부가 아니라 제거로 읽는 편이 자연스럽다. AC 위반은 아니다(무효 시 직전 유효값 유지는 동작함).

**F5 (하): 무효 입력 중에는 패널 안에서 "계산 적용 금액"이 사라진다.**
`condition-panel.tsx:93-99`에서 에러 문구와 보조 표기가 배타적으로 렌더된다. AC4는 요약 섹션이 직전 유효값을 유지하므로 충족되지만, 경고가 뜬 그 자리에서 "그래서 지금 계산에 쓰이는 값이 뭔데"를 볼 수 없다. 둘을 함께 보여주는 편이 낫다.

**F6 (하): `CONDITION_META.OTHER.checkboxLabel`이 어디서도 쓰이지 않는다** (`lib/conditions.ts:39`). `OTHER`를 체크박스로 렌더하지 않기로 했으므로 죽은 값이다. §3 표를 그대로 미러링한다는 의도라면 그 주석을 남길 것.

### AC 확인 결과 (통과 항목)

- 제출 버튼 없음, 입력 4종 모두 onChange로 커밋 — 코드상 확인(브라우저 확인은 F1).
- `9000`/`1000001`/`abc`/빈 문자열 → 전부 경고, `15000` → `만원 단위` 경고. 실제 실행으로 확인함: `out-of-range`/`out-of-range`/`not-a-number`/`empty`/`not-a-step`. 범위 검사가 스텝 검사보다 먼저라 `1000001`이 범위 경고로 나오는 것도 핸드오프대로다.
- 무효 시 `input.monthlyAmount` 미갱신 → 직전 유효값 유지. `setAmountText`가 `result.ok`일 때만 커밋(`lib/use-calc-input.ts:38-48`).
- 기간 선택지는 `TERM_OPTIONS = [6,12,24,36]` 한 곳에서만 나오고 `saveTrm` 스캔 없음. 다른 값을 고를 UI 경로 없음.
- 적립 방식은 `RateOption['rsrvType']`를 재파생(`type ReserveType = RateOption['rsrvType']`), 새 유니온 없음.
- 체크박스 9행(8종 + `OTHER` 안내 행) 문구가 `REALRATE_기능명세서.md:43-51` 표와 **문자 단위로 일치**함을 스크립트로 대조 확인.
- `CheckableConditionCode = Exclude<ConditionCode,'OTHER'>`가 상태 배열 원소 타입이고, `toggleCondition`이 `CHECKABLE_CONDITION_CODES.filter`로 재구성하므로 `OTHER`는 어떤 경로로도 배열에 남지 못한다(살균 효과까지 있음).
- 정렬: `toggleCondition`이 `CONDITION_CODES` 순서로 필터링 → 체크 순서 무관 동일 배열.
- 상태는 평면 직렬화 가능 객체, `Set`/`Map` 없음 → #11 대비 OK.
- 천 단위 구분: `formatKrw` = `Intl.NumberFormat('ko-KR')`, 요약과 보조 표기에 적용.
- a11y 마크업: 금액 `<label htmlFor>`, 3개 그룹 전부 `fieldset`+`legend`, 경고에 `role="alert"`, `aria-describedby`가 에러/도움말 id를 상태에 맞게 전환, 스텝 버튼에 `aria-label`, 체크박스 id는 코드 파생(`cond-${code}`).
- 런타임 의존성 변화 0(`package.json` 무변경), `build`의 `check:reviewed` 게이트 무변경, `lib/types.ts` 무변경, `lib/calc-input.ts`는 React 비의존 순수 모듈, 새 컴포넌트는 `app/_components/` 아래(Tailwind `content` 글롭 안).
- `npm run typecheck` 재실행해 통과 확인함.
- 범위 밖 침범 없음: 이자·금리 계산, `useSearchParams`, 자연어 입력 슬롯 모두 없음. 매칭 상품 건수도 넣지 않았다.
- 설계 결정 이탈: 기록 문서(F1 대응) 언어가 영어인데, 이건 `docs/records/`의 기존 관행과 일치하므로 문제 아님.

## Questions

1. 콤마 포맷을 blur 시점에 입력창 안으로 넣는 안은 명시적으로 버린 건가, 아니면 보조 표기로 충분하다고 판단한 건가? (#11이 URL에서 값을 복원할 때 `amountText` 초기값 포맷을 어떻게 둘지에 영향)
2. 임시 출력에서 매칭 상품 건수를 뺀 것은 의도인가? 뺐다면 AC1의 "반응성" 증거는 요약 문장 하나뿐인데, #5 붙기 전까지 그걸로 충분하다고 보나?
3. `app/page.tsx`의 h1을 `sr-only`로 둔 이유는? 화면상 가장 큰 제목이 여전히 `적금 상품 목록`(h2, 3xl)이라 시각적 위계와 문서 위계가 어긋난다. #5에서 랭킹 테이블이 들어오면 이 자리가 어떻게 정리되나?
4. 스텝 버튼이 하한/상한에 닿았을 때 `disabled` 처리나 안내를 넣지 않은 것은 의도인가? 현재는 아무 반응이 없어(`use-calc-input.ts:52` early return) 버튼이 죽은 것처럼 보인다.

## Test Gaps

- **브라우저 검증 전무** — F1의 5개 AC. 최소한 이슈 #1에서 쓴 DevTools Protocol 경로로 ①기간 12→36 클릭 시 요약 즉시 변경 ②390px 스크린샷 ③Tab 순회 ④Network 패널에 `/api/products` 1회 외 요청 없음 ⑤`OTHER` 행에 `input` 엘리먼트 부재를 확인해 기록할 것.
- **`parseMonthlyAmount` 케이스가 리포트에만 있고 코드에 남지 않았다.** 테스트 러너는 #4 소관이라 지금 러너를 붙이는 건 범위 밖이지만, 확인한 입력/기대값 표를 `docs/records/`에 남겨 두면 #4가 그대로 테이블 테스트로 옮길 수 있다. 지금 커버해야 할 최소 집합: `500000`(유효) / `9000`,`1000001`(범위) / `15000`(스텝) / `abc`,`-20000`,`500000abc`,`10000.5`,`1e5`(숫자 아님) / `''`,`'   '`(빈값) / `500,000`(콤마 유효) / 17자리 초과(범위) / `' 500000'`(현재 거부 — F4 결정 후 기대값 확정).
- **`toggleCondition` 정렬·멱등성 케이스 미확인.** `APP_MISSION` → `SALARY_TRANSFER` 순으로 체크해도 `['SALARY_TRANSFER','APP_MISSION']`이 나오는지, 같은 코드 두 번 토글 시 원상복귀하는지, `OTHER`가 섞인 배열이 입력돼도 제거되는지(타입 단언 우회 시나리오) — 순수 함수라 #4에서 바로 테스트 대상이다.
- **`stepAmount` 경계 케이스 미확인.** 10,000에서 `-`, 1,000,000에서 `+`가 no-op인지, 무효 텍스트 상태에서 스텝을 누르면 텍스트·경고가 커밋값 기준으로 복구되는지.

## Summary

AC 기준으로 **구현 코드는 통과**다. draft(`amountText`)/committed(`CalcInput.monthlyAmount`) 분리, `Exclude<ConditionCode,'OTHER'>`의 타입 레벨 차단, `CONDITION_CODES` 순서 기반 정렬, §3 문구 문자 단위 일치, `fieldset`/`legend`/`role="alert"`/`aria-describedby` 구성, 의존성 0 추가 — 핵심 제약이 모두 지켜졌고 `typecheck`도 재실행해 통과를 확인했다. 유효성 로직은 AC의 모든 입력값에 대해 직접 실행해 기대한 사유 코드가 나오는 것을 확인했다.

머지를 막을 결함은 없다. 다만 **F1(브라우저 검증 5건 미실행)과 F2(리포트 필수 항목 3개 누락)는 머지 전에 채워야 한다** — 접근성·모바일·네트워크 AC는 코드 리딩으로 대체할 수 없고, #3·#5·#11이 이 상태 모양을 그대로 물려받으므로 결정 근거가 리포트에 남아야 한다. F3~F6은 후속 이슈에서 정리해도 되는 수준이다.