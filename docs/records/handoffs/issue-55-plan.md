## Goal

랭킹 테이블의 임의 순위 상품에서도 은행 종속 조건(SALARY_TRANSFER/CARD_USAGE/FIRST_CUSTOMER)의 "미확인" 상태를 확인할 수 있는 UI 진입점을 추가한다. 현재는 `TopProductCard`가 `rankingRows[0]`(항상 1위)만 렌더링하므로, 확인 시 1위로 역전 가능한 2위 이하 상품의 미확인 조건을 사용자가 영원히 확인할 방법이 없다. 이 문서는 데이터/컴포넌트 설계이며, 구현은 Codex가 담당한다.

## Context

- 기준 브랜치: `pr-54`(이슈 #53 / PR #54 구현, 아직 `main` 미병합). Codex는 이 브랜치 위에서 작업을 이어간다. `feature/vercel-analytics` · `origin/main`에는 아직 이 변경이 없으니 혼동하지 말 것.
- `lib/ranking.ts`의 `RankingRow`는 이미 상품마다 `myRateResult`(`applied`/`notMet`/`unconfirmed`/`excluded` 4버킷)를 담고 있다 — 1위 상품뿐 아니라 **모든 행에 이미 미확인 목록이 계산돼 있다**. 즉 이번 작업은 계산 로직을 건드릴 필요 없이 노출 UI만 추가하면 된다.
- 확인 동작의 실제 상태 변경 경로는 이미 존재한다: `top-product-card.tsx`의 `onConditionConfirm(finPrdtCd, code)` → `calculator.tsx`가 `calcInput.setProductConditionOverride`에 연결 → `use-calc-input.ts`의 `setProductConditionOverride` → `calc-input.ts`의 `setProductConditionOverride(input, finPrdtCd, code)`가 `productConditionOverrides[finPrdtCd][code] = true`로 불변 갱신 → `Calculator`의 `useMemo(buildRanking, [input, ...])`가 재계산되어 정렬이 바뀌고 랭킹이 즉시 갱신된다. 이 파이프라인은 `finPrdtCd` 기준으로 동작하므로 **1위가 아닌 상품에도 그대로 재사용 가능**하다 — 새 상태 관리는 필요 없고, 콜백을 어디서 호출하느냐만 늘리면 된다.
- `TopProductCard`의 내부 `ConditionList`는 이미 `onConfirm?: (code) => void`를 받아 은행 종속 조건에만 체크박스를 렌더링하는 재사용 가능한 형태다(`isBankScopedCondition` 판별 포함). "충족 O / 미확인 ? / 미충족 X" 3구획 + 체크박스 UI 전체를 그대로 다른 곳에서도 쓸 수 있게 추출하면 중복 없이 확장 가능하다.
- `RankingTable`(`app/_components/ranking-table.tsx`)은 현재 순수 프레젠테이션 컴포넌트로 `'use client'` 지시어가 없다(부모 `Calculator`가 client라 훅 없이는 동작하지만, 행 펼침 상태를 위해 `useState`를 쓰려면 자체 `'use client'`를 붙여야 한다).
- `lib/bank-condition.ts`의 `isBankScopedCondition`, `lib/my-rate.ts`의 `MyRateResult` 4버킷 타입을 그대로 재사용한다 — 신규 타입 추가는 최소화한다.

## Constraints

- **계산 로직(`lib/my-rate.ts`, `lib/ranking.ts`, `lib/bank-condition.ts`, `lib/action-list.ts`)은 변경하지 않는다.** 이번 이슈는 이미 계산된 `RankingRow.myRateResult`를 UI에 노출하는 문제이지, 판정 규칙 문제가 아니다.
- `TopProductCard`의 기존 마크업/문구/색상/접근성 속성(`aria-labelledby`, 색상 구분 등)과 기존 테스트(`lib/top-product-card.test.ts`)는 회귀 없이 유지한다. 내부 로직을 공용 컴포넌트로 추출하더라도 렌더링 결과(HTML 구조·클래스)가 동일하게 유지되도록 한다 — 순수 리팩터링이면 스냅샷성 테스트가 깨지지 않아야 하고, 부득이 마크업이 바뀌면 해당 테스트를 함께 갱신한다.
- 상태 갱신은 반드시 `finPrdtCd` 단위로만 이루어진다(기존 불변식). 랭킹 테이블에서 여러 행을 동시에 펼쳐도 각 행의 확인 동작은 해당 행의 `finPrdtCd`에만 영향을 준다.
- 행 펼침(확장) UI는 `table` 구조를 깨지 않아야 한다 — 펼친 상세는 같은 행의 별도 `td`(`colSpan`) 또는 그 다음에 삽입하는 `tr`(`colSpan`)로 구현하고, 접근성상 `tbody` 밖으로 상세를 빼내지 않는다.
- 랭킹은 확인 즉시(리렌더 시) 재정렬된다 — 사용자가 펼쳐놓은 행이 재정렬로 다른 순위로 이동해도 펼침 상태가 엉뚱한 행에 남지 않도록, 펼침 상태는 인덱스가 아니라 `finPrdtCd`(+옵션 키, 기존 `key={finPrdtCd-saveTrm-rsrvType}` 패턴과 동일)로 추적한다.
- 미확인 조건이 0개인 상품에는 확장 버튼/배지를 굳이 강조하지 않는다 — 불필요한 시각 노이즈를 늘리지 않는다.
- 기존 테스트 파일 명명·구조 관례(`lib/*.test.ts`에서 컴포넌트도 `renderToStaticMarkup`으로 정적 렌더 검증)를 따른다(`lib/top-product-card.test.ts` 참고).

## Files To Inspect

- `app/_components/ranking-table.tsx` — 배지/펼침 UI 추가 대상. `row.myRateResult.unconfirmed`로 미확인 개수 판별.
- `app/_components/top-product-card.tsx` — `ConditionList`(3구획 렌더링 + 확인 체크박스) 추출 대상. 추출 후 `TopProductCard`와 `RankingTable` 양쪽에서 재사용.
- `app/_components/calculator.tsx` — `RankingTable`에 `onConditionConfirm={calcInput.setProductConditionOverride}` prop 배선 추가(이미 `TopProductCard`에 동일 콜백이 연결돼 있음, 참고).
- `lib/ranking.ts` — `RankingRow` 타입(변경 없음, 참고용. 이미 `myRateResult` 보유 확인).
- `lib/bank-condition.ts` — `isBankScopedCondition`, `BankConditionStatus` 재사용.
- `lib/my-rate.ts` — `MyRateResult` 4버킷 타입 재사용(변경 없음).
- `lib/calc-input.ts`, `lib/use-calc-input.ts` — `setProductConditionOverride` 기존 구현 확인(변경 불필요, 참고용).
- `lib/top-product-card.test.ts` — 기존 스냅샷 검증 패턴, 회귀 확인 및 추출 후 갱신 대상.
- 신규 테스트 파일(예: `lib/ranking-table.test.ts`) — 배지·펼침·확인 콜백 검증.
- `REALRATE_기능명세서.md` §4 — `[B] 결과 랭킹 테이블` 와이어프레임에 배지/펼침 UI 반영.

## Acceptance Criteria

- [ ] `RankingTable`의 각 행에서 `row.myRateResult.unconfirmed.length > 0`이면 미확인 개수를 나타내는 배지(예: "미확인 N")가 표시되고, 0이면 표시되지 않는다.
- [ ] 임의 순위(1위 포함, 2위 이하 포함) 행에 "조건 확인" 진입점(펼침 버튼 등)이 있고, 펼치면 해당 상품의 `applied`/`unconfirmed`/`notMet` 3구획과 미확인 항목별 확인 체크박스가 표시된다.
- [ ] 2위 이하 상품의 미확인 항목을 체크하면 `productConditionOverrides[finPrdtCd][code]`가 갱신되고, 랭킹이 즉시 재계산되어 조건에 따라 1위가 교체될 수 있다(순위 역전 케이스 포함).
- [ ] 위 확인 동작이 다른 상품·다른 은행의 `myRateResult`에 영향을 주지 않는다(기존 `finPrdtCd` 단위 불변식 유지).
- [ ] `TopProductCard`는 기존과 동일하게 1위 상품 상세 카드로 정상 동작하고, `lib/top-product-card.test.ts`가 회귀 없이 통과한다(추출 리팩터링으로 인한 실패 없음).
- [ ] `RankingTable`의 펼침 상태가 랭킹 재정렬 후에도 올바른 상품(`finPrdtCd` 기준)에 유지되거나, 재정렬 후 자연스럽게 접히더라도 엉뚱한 행이 펼쳐진 채로 남지 않는다.
- [ ] `REALRATE_기능명세서.md` §4의 `[B]` 와이어프레임이 배지/펼침 UI를 반영해 갱신된다.

## Verification

- [ ] `npm run typecheck`, `npm test` 통과.
- [ ] 수동 시나리오 1: 1위 상품엔 미확인 조건이 없고, 2위 상품엔 확인 시 1위를 역전할 만큼 큰 미확인 조건(예: `SALARY_TRANSFER`)이 있는 초기 상태를 구성 → 랭킹 테이블에서 2위 행의 미확인 배지 확인 → 펼쳐서 해당 조건 체크 → 그 상품이 1위로 올라오고 `TopProductCard`도 갱신되는지 확인.
- [ ] 수동 시나리오 2: 미확인 조건이 없는 상품, 그리고 이미 1위인 상품에서 배지가 안 뜨거나(0개) 기존 `TopProductCard` 동작에 변화가 없는지 확인(회귀 없음).
- [ ] 수동 시나리오 3: 한 상품의 조건을 확인한 후에도 다른 상품들의 `내금리`/`세후실수령`이 변하지 않는지 랭킹 테이블에서 육안 확인.