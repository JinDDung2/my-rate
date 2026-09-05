## Findings

**1. `clampedAwayBp`가 `maxRate < baseRate` 데이터에서 거짓값을 보고한다 — `lib/my-rate.ts:80-81`**
Constraint 5는 "`maxRate < baseRate`인 데이터가 들어와도 내 금리가 기본금리 아래로 내려가지 않게" 양방향 클램프를 요구했고, `myRateBp`(72행)는 그 요구를 정확히 지킨다. 그런데 함께 반환하는 메타데이터는 지키지 않는다. `baseBp=300, maxBp=290, appliedBp=0`이면 `myRateBp=300`(= `baseRate`, 아무것도 잘리지 않음)인데 `clamped=true`, `clampedAwayBp=10`이 나간다. 설계 결정 6이 `clampedAwayBp`의 용도를 "#6이 '상한에 걸렸습니다'를 설명할 때 필요"라고 못박았으므로, 이 값은 그대로 문구로 렌더된다 — 잘리지 않은 10bp가 잘렸다고 표시된다.
`clampedAwayBp = unclampedRateBp - myRateBp`로 바꾸면 현재 실데이터 전 케이스에서 값이 동일하고(135옵션 모두 `maxRate >= baseRate` 확인함) 퇴화 데이터에서만 옳아진다. `clamped` 쪽은 Verification 4가 `clamped === (toBp(baseRate) + appliedBp > toBp(maxRate))`로 공식을 못박았으므로 현행 유지가 스펙 준수다 — 다만 두 필드의 정의가 서로 어긋난다는 점은 남는다(질문 1).

**2. 핸드오프가 "그대로 둔다"고 명시한 파일 2개를 사전 통지 없이 수정했다 — `lib/use-products.ts:6-16`, `app/_components/product-list.tsx:35`**
"수정할 것" 목록은 `package.json`과 `app/_components/calculator.tsx` 둘뿐이었고, 후자에 대해 "기존 입력 요약 블록과 `<ProductList />`는 그대로 둔다"고 명시했다. 실제로는 `ProductList`의 공개 시그니처(`() => JSX` → `({products}) => JSX`)와 `useProducts`의 export 표면(`ProductsState` 신규 export, `ProductsLoadState` 추가)이 바뀌었다.
**변경 자체는 옳다**: `Calculator`에서 `useProducts()`를 호출하는 이상 prop drilling을 하지 않으면 `/api/products`가 2회 나가고, 이는 Verification 7의 "`/api/products` 1회 제외 추가 요청 없음"과 §10을 정면으로 깬다. 즉 핸드오프의 "ProductList는 그대로 둔다"가 설계 결정 8과 양립 불가능했다. 문제는 판단이 아니라 절차다 — 설계 결정을 다르게 가져갈 때는 "먼저 알릴 것"이 조건이었는데, 구현·커밋이 끝난 뒤 요약에 한 줄로 보고됐다.

**3. 요청 없는 커밋 — `b6f7019`**
핸드오프 "알려진 함정" 마지막 줄과 `docs/agents/development.md:23`("커밋 요청이 없으면 커밋하지 않는다")이 동일하게 금지한 동작이다. 구현 요약은 "구현과 커밋까지 완료했습니다"로 시작한다. 리뷰 findings를 반영하려면 이 커밋 위에 수정 커밋을 쌓거나 amend해야 하고, 이 브랜치가 이미 푸시됐다면 리뷰 전 이력이 남는다.

**4. 검증 기록 문서가 없고, 스크린샷이 관례 밖 경로에 고아로 커밋됐다 — `assets/2026-09-06-issue-3-my-rate-preview.png`**
Verification은 "Codex가 실행하고 결과를 기록할 것"이고, 이슈 #2는 `docs/records/2026-09-05-condition-input-panel-verification.md`를 커밋해 이 요구를 충족했다(`docs/records/README.md` 체계). 이번 커밋에는 `docs/records/` 변경이 0건이다 — 검증 결과가 채팅 응답에만 있고 저장소에 남지 않았다. 게다가 이슈 #2 기록은 스크린샷을 `docs/records/assets/`로 참조하는데(해당 파일은 실제로 없음 — 별건), 이번엔 저장소 최상위에 새 `assets/` 디렉터리를 만들고 136KB PNG를 넣었다. 어떤 문서도 이 파일을 참조하지 않는다.

**5. `useMemo`가 매 렌더 무효화되어 메모이제이션이 전혀 동작하지 않는다 — `app/_components/calculator.tsx:44`**
`useProducts`는 `return { ...state, reload }`(`lib/use-products.ts:63`)로 매 렌더 새 객체를 만든다. 의존성 배열의 `products`가 항상 새 참조이므로, 금액 입력 한 글자마다 43상품 × `findRateOption` + `calculateMyRate` + 정렬이 재실행된다. 비용 자체는 무시할 만하지만 `useMemo`가 의도를 배신하고 있고, #5 랭킹 테이블이 이 코드를 출발점으로 삼으면 상품 수·정렬 비용이 커진 뒤에 문제가 된다. 의존성을 `products.status`, `products.data`로 좁히면 해결된다.

**6. `ProductsState`와 `ProductsLoadState`가 3분기 유니온을 손으로 이중 관리한다 — `lib/use-products.ts:6-14`**
두 타입의 유일한 차이가 `reload` 필드다. `export type ProductsState = ProductsLoadState & { reload: () => void }` 한 줄이면 분기 추가 시 동기화 누락이 생길 여지가 사라진다.

**7. `Set<string>`으로의 불필요한 타입 넓힘 — `lib/my-rate.ts:43`**
`new Set<string>(selected)`는 `condition.code`가 `ConditionCode`이므로 `Set<ConditionCode>`로 충분하고, 그 편이 오타 코드가 조용히 통과하는 경로를 막는다.

## Questions

1. `clamped`와 `clampedAwayBp`의 정의 불일치(위 F1)를 어느 쪽으로 맞출까 — Verification 4 공식을 정본으로 두고 `clampedAwayBp`만 `unclampedRateBp - myRateBp`로 고칠지, 아니면 두 필드를 모두 "실제로 잘려나갔는가" 기준으로 통일하고 Verification 4 문구를 #3 기록에서 정정할지. 실데이터 결과는 어느 쪽이든 동일하다.
2. `findRateOption`이 `intrRateType`(단리 S / 월복리 M)을 매칭 조건에서 제외했다. 현재 데이터에서 `(상품, 만기, 적립방식)` 중복은 0건이라 선택은 결정적이지만, 실제로 `M`(월복리) 옵션이 데이터에 존재한다. #4 이자 엔진은 단리/월복리를 구분해야 하는데, 이 헬퍼가 고른 옵션의 `intrRateType`을 그대로 신뢰하면 되는가 — 아니면 #4에서 `intrRateType`까지 받는 오버로드가 필요한가? 지금 결정해두지 않으면 #4에서 헬퍼 시그니처를 다시 건드리게 된다.
3. F2의 `ProductList` 시그니처 변경을 유지할까? (#5가 어차피 이 자리를 랭킹 테이블로 대체하므로 유지가 합리적으로 보이지만, 핸드오프 위반이라 승인 절차를 밟는 게 맞다.)
4. `b6f7019`를 그대로 둘지, 리뷰 반영 후 amend/재작성할지.
5. 스크린샷을 `docs/records/assets/`로 옮기고 이슈 #3 검증 기록 문서에서 참조하도록 정리할까?

## Test Gaps

1. **Constraint 5의 핵심인 하한 클램프가 어떤 테스트로도 커버되지 않는다.** 실데이터에 `maxRate < baseRate` 옵션이 0건이고(직접 확인), 합성 픽스처도 전부 `maxRate > baseRate`다(`optionFixture` 기본값 3.2/4.2 포함). `lib/my-rate.ts:72`의 `Math.max(baseRateBp, ...)`를 삭제해도 13개 테스트가 전부 통과한다. `baseRate 3.0 / maxRate 2.9` 픽스처로 `myRate === 3.0`을 단언하는 케이스가 필요하다(F1을 고친다면 `clampedAwayBp === 0`도 함께).
2. **`findRateOption`의 `rsrvType` 분기가 직접 검증되지 않는다.** 동일 만기에 `S`와 `F`를 모두 가진 상품이 6건 있는데(`WR0001F`, `WR0001L`, `TD11330029000` 등), 그중 하나로 `findRateOption(p, 12, 'F')`가 `F` 옵션을 돌려주는지 단언하는 테스트가 없다. 현재는 268행의 null 테스트가 간접적으로만 걸린다.
3. **`clampedAwayBp`가 전수 불변식 루프(274-305행)에 없다.** `appliedBp`·`clamped`·3버킷 분할·정렬은 43상품 × 135옵션 × 5부분집합으로 돌면서 `clampedAwayBp`만 개별 케이스 2개에서 확인된다. `clampedAwayBp === Math.max(0, toBp(base) + appliedBp - toBp(max))` 한 줄을 루프에 넣으면 된다.
4. **부동소수점 회귀 루프의 단언 2개가 사실상 동어반복이다 — `lib/my-rate.test.ts:254-255`.** `myRate`는 구현상 `myRateBp / 100`이므로 255행은 항상 참이고, 254행은 `toFixed(8)`이 오차를 흡수해 거의 항상 참이다. Verification 5가 요구한 "결과가 `x.xx` 2자리로 정확히 떨어지는가"를 실제로 방어하는 건 253행(`myRateBp === toBp(baseRate) + rateBp`)과 264행의 `3.3` 케이스뿐이다. `assert.equal(String(result.myRate), expected)`처럼 % 표현 자체를 비교하는 단언이 42조합 전부에 있어야 의도한 회귀 테스트가 된다.
5. **기대값을 금지된 방식으로 만든 단언 — `lib/my-rate.test.ts:166.`** `assert.equal(result.myRate, option.baseRate + 0.2)`는 Constraint 1이 "어디에도 쓰지 않는다"고 한 실수 누적을 테스트가 그대로 쓴다. `2.55 + 0.2`가 우연히 `2.75`로 떨어져 지금은 통과하지만, 다음 데이터 갱신에서 이 상품의 `baseRate`가 실측 3의 39건 중 하나로 바뀌면 구현이 옳아도 테스트가 깨진다. `(toBp(option.baseRate) + 20) / 100`으로 기대값을 만들어야 한다.
6. (확인했고 문제 없음) `return it.skip(...)`(93·137·156행)은 실행해보니 중첩 SKIP으로 러너 요약의 `skipped` 카운트에 정상 집계되고 부모는 pass로 끝난다 — "실패가 아니라 명시적 skip" 요구를 충족한다.

## Summary

핵심 산출물인 `lib/my-rate.ts`는 **AC를 실질적으로 충족한다.** bp 정수 산술이 경계에서 한 번씩만 `Math.round(rate * 100)`으로 들어가고 마지막에 한 번만 `/100`으로 나오며, 실수 누적 경로가 없다. `OTHER`·`rateBp === 0` 제외, 미제공 조건 무시, 중복 행 합산(설계 결정 2), 옵션 단위 `maxRate` 클램프, 3버킷 분할, `CONDITION_CODES` → 원본 순서 정렬, `product.conditions` 원본 배열 비파괴(`map` 후 정렬), `findRateOption`의 `null` 반환까지 전부 명세대로다. React/Next import 0개도 확인했다.

직접 실행한 검증: `npm test` 13/13 통과, `npx tsc --noEmit` 통과, `npm run check:reviewed` 통과(43건 reviewed). `git show --stat`으로 `lib/types.ts`·`data/products.json`·`lib/calc-input.ts`·`lib/conditions.ts`·`scripts/**` 무변경, `package.json`은 `test` 스크립트 1줄만 추가됨을 확인했다. 핸드오프의 데이터 실측 주장도 원본 데이터로 재확인했다 — 43상품/135옵션, `(만기, 적립방식)` 중복 0건, `maxRate < baseRate` 0건, `OTHER && rateBp !== 0` 34건, `unexplainedBp > 0` 8건, KB내맘대로적금 조건 합 70bp/갭 60bp. `npm run build`는 `.next/` 산출물을 쓰므로 재실행하지 않았고, 그 앞단 게이트인 `check:reviewed`만 따로 확인했다.

막아야 할 결함은 없다. 남은 건 (a) 퇴화 데이터에서만 드러나는 `clampedAwayBp` 오보고, (b) 하한 클램프·`rsrvType` 분기의 테스트 공백, (c) 절차 이탈 3건(범위 밖 파일 수정, 요청 없는 커밋, 검증 기록 문서 누락)이다. (a)와 (b)는 한 줄씩 고치면 끝나고, (c)는 코드가 아니라 승인의 문제다.