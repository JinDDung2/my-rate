CLAUDE.md 및 관련 모듈(`my-rate.ts`, `ranking.ts`, `interest.ts`, `conditions.ts`, `calc-input.ts`, `types.ts`, `format.ts`, `calculator.tsx`, `top-product-card.tsx`, `use-products.ts`)을 읽고 diff를 Acceptance Criteria 기준으로 검토했다.

## Findings

없음.

검토 결과 diff는 핸드오프의 Acceptance Criteria를 모두 충족한다. 확인한 항목:

- `lib/action-list.ts`는 `react`/`next` import 없이 `@/lib/*` 순수 모듈만 참조한다. `'use client'` 없음.
- baseline을 `calculateMyRate(product, option, input.selectedConditions)` + `calculateInterest`(`annualRate = myRateBp/10000`, `interestType = option.intrRateType`)로 내부 재계산 → `ranking.ts:38-44`와 동일 규약. 테스트 `keeps baseline interest aligned with buildRanking row interest`가 이를 교차검증.
- 후보는 `baselineMyRate.unapplied`에서만 도출, `codeToRateBp` Map으로 코드 단위 dedup, `rateBp`는 해당 코드 미충족 행 합. `calculateMyRate`가 `Set<code>`로 판정하므로 dedup된 코드 1개 추가 시 그 코드의 모든 조건이 적용됨(테스트 확인).
- 각 시뮬레이션 조건 집합 = `[...input.selectedConditions, code]` 정확히 1개 추가. 조합 없음. 테스트 `measures each addition on top of already selected conditions`가 `combinationAdded`와 다름을 명시적으로 assert.
- 필터 `afterTaxInterestDelta > 0` (0 포함 제외), 정렬 delta 내림차순 → `CONDITION_CODES` 순서 tie-break(고유값이라 결정적), `MAX_ACTIONS = 3` slice.
- baseline이 `maxRate` 클램프면 모든 delta 0 → 빈 배열. 부분 클램프는 유효 증가분만 반영하되 `>0`이면 유지(테스트 확인).
- `OTHER`는 `isCountable`에서 `unapplied` 진입 전 제외되므로 `condition.code as CheckableConditionCode` 캐스트 및 `CONDITION_META[code].label` 접근 안전.
- `ActionListCard`는 `rankingRows[0]` → `products.find(finPrdtCd)` → `buildActionList(product, topRow.option, input)`. `!topRow` / `!product` / `actions.length === 0` 시 `null`(→ `renderToStaticMarkup` `''`).
- 카드 금액은 `+{formatKrw(delta)}원`으로 천 단위 표기, slice된 최대 3행만 렌더.
- `calculator.tsx`에서 `TopProductCard` 다음, `rankingRows.length > 0 && products.status === 'success'` 조건, `products={products.data.products}` `input={input}` 전달.
- 변경 범위는 신규 파일 4개 + `calculator.tsx`(Modify 허용) + 검증 기록 문서로 한정. 금지 파일 무변경.
- `objectParticle`: 한글 받침 유무 `(code - 0xAC00) % 28`로 `을/를` 선택. 현재 라벨 전부 한글 종결이라 정상 동작("카드 실적"→을, "첫 거래"/"자동이체"→를).
- 테스트 delta 값(`+13,748`/`+10,998`/`+5,499`, `2750`/`1650` 등) 손계산과 일치.

## Questions

없음.

## Test Gaps

블로킹은 아니나 보강 여지:

- `ActionListItem.label === CONDITION_META[code].label`을 직접 assert하는 모듈 테스트가 없다. 모듈 테스트 픽스처는 커스텀 라벨을 쓰고 `code`만 검증하며, 실제 라벨 매핑은 카드 테스트 문자열("자동이체" 등)로만 간접 확인된다.
- `interestType: 'M'`(월복리) 경로에 대한 액션 리스트 테스트가 없다. 모든 픽스처가 `'S'`.
- `NON_FACE_TO_FACE`, `LINKED_PRODUCT`, `APP_MISSION` 코드는 어떤 테스트에서도 후보로 등장하지 않는다(받침 있는 라벨 "출석" 등 particle 분기 미검증).
- 실데이터(`buildRanking(DEFAULT_CALC_INPUT)` → `buildActionList`) 교차검증은 검증 문서 덤프로만 존재하고 자동화 테스트는 없다(핸드오프가 문서 덤프를 허용하므로 규정 위반은 아님).
- `npm run build`는 샌드박스 `tsx` IPC `EPERM`으로 실패 후 외부 실행에서만 통과 — 환경 이슈로 코드 결함은 아니나 CI에서 재현 확인 권장.

## Summary

Acceptance Criteria 관점에서 결함 없음. 순수 모듈 분리, baseline 재계산 규약 일치, 단일조건 시뮬레이션·코드 dedup·`>0` 필터·결정적 tie-break·3개 제한·카드 `null` 처리·`calculator.tsx` 배선·금지 파일 무변경까지 모두 명세대로 구현되었고, 테스트가 조합 미계산과 baseline-ranking 정합성을 명시적으로 방어한다. 손계산 교차검증 수치도 일치한다. Test Gaps는 라벨 매핑 직접 검증, 월복리 경로, 미사용 조건 코드 커버리지 정도로 모두 비블로킹이다.