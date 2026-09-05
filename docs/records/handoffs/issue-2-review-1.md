CLAUDE.md과 스펙 §3/§4/F-02/§10, `lib/types.ts`, `lib/use-products.ts`, 커밋된 실제 파일을 읽고 `npx tsc --noEmit`을 재실행한 뒤 리뷰했다.

## Findings

**AC 17개는 전부 충족한다.** 아래는 AC를 깨지 않지만 실재하는 문제다.

**F1. 핸드오프가 명시적으로 요구한 산출물 1건이 누락됐다 — 어디에도 기록이 없다.** (중)
핸드오프 Context: *"이 이슈에서는 스펙대로 정액적립을 기본값으로 두되, #5에서 빈/희소 결과 처리와 기본값 재검토가 필요하다는 사실을 **남긴다**."* `docs/records/`에도, 코드 주석에도, 커밋 메시지에도 이 리스크가 없다(`grep -rn "정액적립" docs lib app` → 이슈 원문·타입 주석·UI 라벨뿐). `reserveType: 'S'` 기본값(`lib/calc-input.ts:23`)은 43상품 중 12건만 후보로 남긴다는 실측 근거가 있는 결정인데, 그 근거가 코드에도 문서에도 없어서 #5 담당자는 이 기본값을 무해한 목업 복사로 읽게 된다. `docs/records/2026-09-05-*.md` 형식으로 결정 기록이 필요하다.

**F2. `stepAmount`가 상태 업데이터 안에서 다른 상태를 갱신하고, 경계에서 no-op 리렌더를 만든다.** (중) — `lib/use-calc-input.ts:49-62`
```ts
setInput((current) => {
  const monthlyAmount = clampMonthlyAmount(...);
  setAmountTextState(String(monthlyAmount)); // 업데이터는 순수해야 한다
  setAmountError(null);
  return { ...current, monthlyAmount };      // 항상 새 객체
});
```
두 가지가 걸린다.
- **부수효과**: Next 16의 `reactStrictMode` 기본값은 true이므로 dev에서 업데이터가 2회 호출된다. 지금은 두 setter가 멱등이라 눈에 보이는 고장은 없다. 문제는 결합이다 — 나중에 누가 클램프 경계에서 `return current` 바일아웃을 넣으면 텍스트/경고 갱신이 조용히 함께 사라진다.
- **바일아웃 부재(관측 가능)**: `monthlyAmount`가 `1,000,000`인 상태에서 `+`를 눌러도 값은 그대로인데 `{...current}`가 매번 새 객체를 만든다. → `Calculator` → `ConditionPanel` + `ProductList`(43상품·135옵션) 전체가 무의미하게 리렌더된다. 하한 `10,000`에서 `-`도 동일. 이 상태는 **#3·#5가 `useMemo([input])`로 소비할 객체**이므로, 지금 identity가 헛돌면 랭킹 재계산이 no-op 클릭마다 돈다.
  수정 방향: 다음 값을 업데이터 밖에서 계산하고(`input.monthlyAmount`를 deps에 넣은 `useCallback`), 세 setState를 최상위에서 나란히 호출한다. 값이 같으면 조기 반환한다.

**F3. `parseMonthlyAmount`가 비숫자를 "거부"가 아니라 "제거"해서, 무효 입력이 무경고로 커밋된다.** (중) — `lib/calc-input.ts:36-44`
`text.replace(/\D/g, '')`의 실제 결과:
- `-20000` → 부호가 사라져 **20,000원으로 커밋, 경고 없음**. 사용자가 음수를 쳤는데 양수가 계산에 들어간다.
- `500000abc` → **500,000원 커밋, 경고 없음**. 입력창에는 `500000abc`가 그대로 보이는데 아래엔 `계산 적용 금액: 500,000원`이 뜬다. AC2의 `abc`(순수 문자)만 통과할 뿐, 혼합 입력은 뚫린다.
- `10000.5` → `100005` → **`만원 단위` 아닌 `범위 밖` 경고**(사유 오분류).
- 17자리 이상 → `Number.isSafeInteger` 실패 → `숫자로 월 납입액을 입력해 주세요`. 숫자인데 "숫자로 입력하라"고 한다. `out-of-range`가 맞다.

핸드오프의 처리 순서(`숫자 외 문자 제거 → 파싱`)를 문자 그대로 따른 결과이긴 하나, 같은 문서의 함정 항목은 *"비숫자 문자를 파싱 전에 명시적으로 걸러낼 것"*이라 했다. `/^\d+$/`(콤마 허용이 필요하면 `/^[\d,]+$/` 후 콤마만 제거) 검사로 바꾸고, 안전 정수 초과는 `out-of-range`로 분류하는 게 맞다.

**F4. 적립 방식 라벨이 두 곳에 하드코딩됐다.** (하) — `app/_components/calculator.tsx:9-11`의 `formatReserveType`과 `app/_components/condition-panel.tsx:24-27`의 `RESERVE_TYPE_OPTIONS`가 `'정액적립'/'자유적립'`을 각각 들고 있다. 조건 라벨은 `lib/conditions.ts`로 상수화(제약 4)해 놓고 적립 방식만 JSX 옆에 흩어졌다. #5 랭킹·#6 상세 카드가 같은 문자열을 또 복제할 자리다. `lib/calc-input.ts`에 `RESERVE_TYPE_LABELS: Record<ReserveType, string>` 하나로 모아야 한다.

**F5. 경고 문구가 범위 상수를 재사용하지 않는다.** (하) — `lib/use-calc-input.ts:21`이 `'10,000원 ~ 1,000,000원 사이로 입력해 주세요'`를 리터럴로 박았다. 바로 위 모듈에 `MONTHLY_AMOUNT_MIN/MAX`와 `formatKrw`가 있는데도 그렇다. 상한/하한을 바꾸면 검증은 바뀌고 문구는 안 바뀌는 조합이 만들어진다.

**F6. 한 페이지에 `<h1>`이 둘이다.** (하) — `condition-panel.tsx:48` `내 적금 조건`, `product-list.tsx:64` `적금 상품 목록`. 이슈 #1까지는 후자가 유일한 h1이었다. 헤딩 순서가 `h1 → h2(요약) → h1`이 되어 스크린리더 문서 개요가 깨진다. §10 WCAG AA 맥락에서 정리 대상 — 패널을 `h2`로 내리거나 `page.tsx`에 페이지 h1을 두고 둘 다 `h2`로 가는 편이 낫다.

**F7. `OTHER` 안내 행에 "계산 제외"가 두 번 나온다.** (나이트) — `conditions.ts`의 라벨이 이미 `기타(계산 제외)`인데(`lib/conditions.ts:39`) 옆에 `계산 제외` 배지를 또 붙였다(`condition-panel.tsx:171-174`). 라벨은 §3 표 그대로 유지해야 하니 배지 문구를 `선택 불가` 등으로 바꾸는 쪽이 맞다.

**확인했고 문제 없는 항목:** 체크박스 문구 8종이 `REALRATE_기능명세서.md:43-50` "체크박스 문구" 열과 **글자 단위로 일치**. `Exclude<ConditionCode, 'OTHER'>` 타입 차단 + `OTHER` 비체크박스 렌더 이중 방어. `toggleCondition`이 `CHECKABLE_CONDITION_CODES.filter`로 정렬 불변식 보장(체크 순서 무관 동일 배열 → #11 직렬화 결정성 확보). 상태는 평면 직렬화 가능 객체, `Set`/`Map` 없음. `TERM_OPTIONS` 단일 출처, 데이터 스캔 아님. `min-h-12`/`has-[:checked]:`는 설치된 tailwind 3.4.19에서 유효(v3.4에서 `minHeight`가 spacing 스케일을 포함, `has-*`는 v3.4 도입) — 클래스가 날아가지 않는다. `lib/calc-input.ts`는 React 임포트 0건인 순수 모듈. `lib/types.ts` 무수정. 신규 컴포넌트는 `app/_components/` 아래(tailwind content 글롭 안). `package.json` 무변경. 새 파일에 `console.*`/`fetch` 0건. **`useProducts`의 effect deps가 `[requestId]`로 안정적이라, `Calculator`가 키 입력마다 리렌더돼도 `/api/products` 재요청은 발생하지 않는다** — AC17은 구조적으로 성립한다(Codex의 수동 관측과 일치).

## Questions

1. **F1의 기록을 이 이슈에서 남길 것인가, #5 이슈 본문에 코멘트로 남길 것인가?** 어느 쪽이든 남아야 한다.
2. **스텝 버튼이 무효 draft를 무시하는 것이 의도인가?** `15000` 입력(경고 상태) 후 `+`를 누르면 `20000`이나 `25000`이 아니라 **`510000`**(직전 유효값 500,000 기준)이 되고 입력창 텍스트도 그렇게 덮인다. 커밋값 기준 스텝이라는 점에서 일관되지만, 사용자 입장에서는 자기가 친 숫자가 사라지는 동작이다. 의도라면 그대로 두고, 아니라면 draft가 파싱은 되되 스텝만 안 맞는 경우(`15000`)엔 draft 기준으로 스냅하는 선택지가 있다.
3. **음수 입력 정책(F3)** — 부호를 무시할 것인가, 무효로 볼 것인가? 무시가 의도라면 그건 명시적 결정으로 기록돼야 한다.
4. **`Calculator`가 `input` 객체 전체를 `ConditionPanel`에 넘기는 구조**를 #5~#7까지 유지할 것인가? 유지한다면 F2의 identity 안정성이 전제 조건이 된다.

## Test Gaps

테스트 러너는 #4 소관이라 자동 테스트 부재 자체는 지적하지 않는다. 다만 **`lib/calc-input.ts`는 지금 이미 순수 모듈이므로, #4가 러너를 붙이는 순간 아래가 첫 테스트 대상이어야 한다.** 이 목록을 #4 핸드오프에 넘길 것을 권한다.

- `parseMonthlyAmount` 케이스 표: `''`, `'   '`, `'abc'`, `'9000'`, `'1000001'`, `'15000'`, `'500000'`, `'10000'`(하한 경계), `'1000000'`(상한 경계) — 여기까지는 수동 검증됨. **미검증**: `'-20000'`, `'500000abc'`, `'10000.5'`, 17자리 초과 (= F3 전부). 회귀 테스트가 없으면 F3을 고쳐도 다시 깨진다.
- `toggleCondition`의 **정렬 불변식**: 임의 순서로 8종을 토글해도 결과가 `CHECKABLE_CONDITION_CODES` 순서와 같다는 속성 테스트. AC10과 #11 직렬화 결정성이 여기 걸려 있는데, 지금은 "정렬된 것처럼 보인다"는 눈 검증뿐이다.
- `clampMonthlyAmount` 경계값 3종(하한 미만/상한 초과/범위 내).
- **`CONDITION_META`가 §3 표와 일치하는지 자동 확인 수단이 없다.** 지금은 내가 눈으로 대조했다. 명세서 표를 파싱해 비교하는 테스트가 가장 좋지만 과하다면, 최소한 `CHECKABLE_CONDITION_CODES.length === 8`과 `CONDITION_META`의 키가 `CONDITION_CODES`와 일대일인지(`Record` 타입이 이미 후자를 보장하긴 한다) 정도는 고정할 수 있다.

검증 방식 자체의 공백:
- **`npm run build`를 나는 재실행하지 않았다**(빌드 산출물 기록 방지). `npm run typecheck`는 재실행해 **통과(exit 0)** 확인했다. `check:reviewed` 선행 여부는 `package.json:13`의 `npm run check:reviewed && next build` 정의로 구조적으로만 확인했고, Codex의 실행 로그는 그대로 신뢰했다.
- **390px 스크린샷이 `/private/tmp/`에 있어 리뷰 시점에 남아 있지 않다.** 저장소나 PR에 첨부되지 않으면 재확인 경로가 없다.
- §10의 **200ms 갱신 요건이 측정되지 않았다.** 키 입력마다 `ProductList`(43상품)가 통째로 리렌더되는 현재 구조는 아직 여유가 있겠지만, #5 랭킹 테이블이 붙으면 이 경로가 병목 후보다. F2의 no-op 리렌더와 함께 볼 것.

## Summary

**머지 가능하다.** Acceptance Criteria 17개는 모두 충족하고, 지키기 어려운 제약(타입 레벨 `OTHER` 차단, 정렬 불변식, 직렬화 가능한 평면 상태, draft/committed 분리, 의존성 0, 네트워크 0)이 정확히 지켜졌다. 체크박스 문구는 스펙 표와 글자 단위로 일치하고, `useProducts`와 `/api/products` 계약은 손대지 않았다. typecheck 재실행 통과.

머지 전에 처리할 것은 **F1(핸드오프가 요구한 정액적립 기본값 리스크 기록 누락 — 코드 아닌 문서 산출물이라 지금 안 남기면 영영 안 남는다)** 하나다.

바로 뒤이어 고칠 것은 **F2**(상태 identity가 #3·#5의 메모이제이션 기반이 되므로 소비자가 붙기 전이 가장 싸다)와 **F3**(`-20000` → 20,000원 무경고 커밋은 금액 입력에서 그냥 버그다). F4~F7은 #5 착수 시 함께 정리해도 무방하다.