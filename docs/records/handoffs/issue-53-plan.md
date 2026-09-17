## Goal

이슈 #53 수정: 은행 특정 우대조건(SALARY_TRANSFER/CARD_USAGE/FIRST_CUSTOMER)이 실제 해당 은행이 아닌 모든 상품에 무차별 적용되는 결함을 제거하고, "미확인" 상태를 도입해 미선택과 미충족을 구분한다. 코드 구현은 Codex가 담당하며, 아래는 확정된 데이터 모델·계산 규칙·UI 변경 설계다.

## Context

- 현재 `CalcInput.selectedConditions`(`lib/calc-input.ts:12`)는 상품/은행 비종속 전역 배열이며, `lib/ranking.ts:40`이 이를 그대로 모든 상품에 넘겨 `calculateMyRate`(`lib/my-rate.ts:38`)를 호출한다. `MyRateResult`는 `applied`/`unapplied`/`excluded` 3버킷뿐이라 "미선택(모름)"과 "확인 후 미충족"을 구분 못 한다.
- `CONDITION_META`(`lib/conditions.ts`) 8종 중 `SALARY_TRANSFER`, `CARD_USAGE`, `FIRST_CUSTOMER` 3종만 "이 은행" 전제 문구다. 나머지 5종(`AUTO_TRANSFER`, `MARKETING_AGREE`, `NON_FACE_TO_FACE`, `LINKED_PRODUCT`, `APP_MISSION`)은 은행 비종속 의향 질문 — 이번 작업에서 손대지 않는다(Out of Scope 유지).
- 은행명은 `data/products.json`의 `companyName` 14종과 정확히 일치해야 한다: 광주은행, 국민은행, 농협은행주식회사, 부산은행, 신한은행, 아이엠뱅크, 우리은행, 전북은행, 제주은행, 주식회사 카카오뱅크, 주식회사 케이뱅크, 주식회사 하나은행, 중소기업은행, 한국산업은행.
- 상품 상세 화면은 현재 랭킹 1위 상품에 대해서만 존재한다(`app/_components/top-product-card.tsx`). 요청자 Scope도 "1위 상품 상세 카드 등"으로 한정했으므로, 이번 작업의 "상품별 확인 진입점"은 `TopProductCard`에 추가한다.

### 확정 설계

**1) 전역 패널 입력 변경 (`ConditionPanel`, `CalcInput`)**

- 체크박스 8종 중 `SALARY_TRANSFER`, `CARD_USAGE`를 제거하고, 대신 단일 선택(드롭다운/라디오) 2개를 추가한다:
  - "급여이체 받는 은행" → `salaryTransferBank: string | null` (`companyName` 값 또는 "선택 안 함" → `null`)
  - "카드실적 채우는 은행" → `cardUsageBank: string | null` (동일 구조)
- `FIRST_CUSTOMER`("이 은행과 첫 거래예요")는 전역에서 판단 불가능하다고 결론(어느 은행이든 "처음"일 수 있어 단일/다중 선택으로 전역 표현이 부적절) → 전역 패널에서 **완전히 제거**하고, 상품 상세에서만 확인한다. **가정**: 이 결론에 이견 있으면 기획 재검토 필요.
- 나머지 5종은 기존 `selectedConditions` 배열에 남긴다. 타입을 좁혀 은행 비종속임을 명시:
  ```ts
  export type BankScopedConditionCode = 'SALARY_TRANSFER' | 'CARD_USAGE' | 'FIRST_CUSTOMER';
  export type GlobalConditionCode = Exclude<CheckableConditionCode, BankScopedConditionCode>;
  ```
  `CalcInput.selectedConditions: GlobalConditionCode[]`로 축소.
- `CalcInput`에 상품별 오버라이드 저장소 추가:
  ```ts
  productConditionOverrides: Record<string /* finPrdtCd */, Partial<Record<BankScopedConditionCode, true>>>;
  ```
  값은 "사용자가 상품 상세에서 명시적으로 체크함(=적용/의향 있음)"만 표현한다(true만 저장, 없으면 자동 판정 규칙 적용). 명시적 "아니오" 저장은 이번 스코프에서 제외(필요 시 후속 이슈).

**2) 상태 판정 규칙 (신규 모듈, 예: `lib/bank-condition.ts`)**

각 은행 종속 조건의 상품별 상태는 `applied | notMet | unconfirmed` 3값이다.

```ts
export type BankConditionStatus = 'applied' | 'notMet' | 'unconfirmed';

function resolveBankScopedStatus(
  code: BankScopedConditionCode,
  companyName: string,
  finPrdtCd: string,
  input: CalcInput,
): BankConditionStatus {
  if (input.productConditionOverrides[finPrdtCd]?.[code]) return 'applied';

  if (code === 'FIRST_CUSTOMER') return 'unconfirmed'; // 전역 입력 없음, 항상 상품별 확인 필요

  const selectedBank = code === 'SALARY_TRANSFER' ? input.salaryTransferBank : input.cardUsageBank;
  if (!selectedBank) return 'unconfirmed';
  return selectedBank === companyName ? 'applied' : 'unconfirmed';
}
```

- **불일치(다른 은행 선택)를 `notMet`이 아니라 `unconfirmed`로 처리**하는 것이 의도된 설계다 — 요청자 Verification 항목("B은행 상품 랭킹에서 SALARY_TRANSFER가 **미확인**으로 표시")과 일치시켰다. 사용자가 다른 은행을 골랐다고 해서 이 상품에서 급여이체를 절대 안 할 것이라 단정하지 않고, 상품 상세에서 "의향" 확인 여지를 남긴다.
- `notMet`은 이번 스코프에서 유일하게 도달 가능한 경로가 없다(향후 "명시적으로 아니오" 오버라이드를 넣을 자리로 타입만 예약). Codex는 타입에는 포함하되 현재 생성 로직에서 `notMet`을 실제로 반환하지 않아도 무방하다 — 단, `MyRateResult.unconfirmed`가 비어있지 않아야 하는 케이스(위 규칙상 대부분)를 테스트로 커버해야 한다.

**3) `MyRateResult` / `calculateMyRate` 변경 (`lib/my-rate.ts`)**

```ts
export interface MyRateResult {
  myRate: number;
  myRateBp: number;
  baseRate: number;
  maxRate: number;
  appliedBp: number;
  clamped: boolean;
  clampedAwayBp: number;
  applied: SpecialCondition[];
  notMet: SpecialCondition[];      // 기존 unapplied → 이름 변경(의미가 "확인 후 미충족"으로 좁아짐)
  unconfirmed: SpecialCondition[]; // 신규: 은행 종속 조건 중 미확인
  excluded: SpecialCondition[];
}
```

- 시그니처는 `calculateMyRate(product, option, resolveStatus)` 형태로 바꾼다. `resolveStatus: (code: CheckableConditionCode) => 'applied' | 'notMet' | 'unconfirmed'`를 호출자가 주입 — 은행 비종속 5종은 기존처럼 `selectedConditions.includes(code) ? 'applied' : 'notMet'`으로 판정, 은행 종속 3종은 `resolveBankScopedStatus` 결과를 사용. `ranking.ts`가 이 판정 함수를 조립해서 넘긴다(상품마다 `companyName`/`finPrdtCd`가 다르므로 상품별로 새로 만들어야 함).
- `appliedBp` 계산(`unclampedRateBp`)은 `applied`만 합산 — 기존과 동일. `unconfirmed`/`notMet`은 절대 가산하지 않는다.
- `isCountable` 로직은 변경 없음(`OTHER`/`rateBp===0` 제외).
- `lib/action-list.ts`도 동일한 판정 함수를 받아야 한다(현재 `input.selectedConditions`를 직접 참조 — bank-scoped 조건을 "추가하면 얼마"로 시뮬레이션할 때도 같은 규칙을 써야 함). 액션 리스트가 `unconfirmed`를 "추가 시 이득" 시뮬레이션 대상에 포함할지도 결정 필요 — **권장**: `unconfirmed`도 시뮬레이션 대상에 포함(현재 `unapplied` 전체를 대상으로 하던 동작과 동일하게 유지, 문구만 "확인하면"/"체크하면"으로 자연스럽게 유지).

**4) 상품 상세 화면 (`TopProductCard`)**

- `myLeader.myRateResult.unconfirmed`를 새 섹션 "미확인 ?"으로 렌더링(기존 "충족 O" / "미충족 X" 사이 또는 아래). 각 항목에 체크박스를 붙여 "확인/의향 있음" 표시 → 체크 시 `productConditionOverrides[finPrdtCd][code] = true`로 상태 갱신, 리랭킹 재계산.
- 문구는 요청자 예시를 따른다: "미확인 ?" / "미충족 X" / "충족 O"를 스타일(색상)로도 구분한다(예: 충족=초록, 미충족=회색/취소선, 미확인=노랑/주의색 + 체크 가능).
- `ranking-table.tsx`는 조건 상태를 표시하지 않으므로 변경 불필요(범위 밖). 수동 검증 시 B은행 상품이 랭킹 1위가 아니면 상세 카드로 확인할 수 없다는 제약이 있음 — Verification 항목에 명시.

**5) 관련 파일 연쇄 수정**

- `lib/calc-input.ts`: `toggleCondition`/`applyConditions`를 `GlobalConditionCode` 기준으로 좁히고, `salaryTransferBank`/`cardUsageBank`/`productConditionOverrides` 세터 함수 추가. `DEFAULT_CALC_INPUT`에 기본값(`null`, `null`, `{}`) 추가.
- `lib/use-calc-input.ts`: 새 필드에 대응하는 `setSalaryTransferBank`, `setCardUsageBank`, `setProductConditionOverride(finPrdtCd, code)` 훅 추가.
- `lib/share-url.ts`: 최소한 `salaryTransferBank`/`cardUsageBank`는 쿼리스트링에 직렬화(짧은 은행 코드로 인코딩 권장, 예: `companyName` 배열 인덱스). **`productConditionOverrides`는 이번 스코프에서 URL 공유 대상에서 제외**(세션 상태로만 유지) — 상품별 오버라이드까지 URL에 넣으면 스킴이 복잡해지고 F-11 목적(재현 가능한 링크)에 비해 이득이 작다. 이 결정에 이견 있으면 별도 확인.
- `app/_components/condition-panel.tsx`: 체크박스 목록에서 3종 제거, 은행 선택 UI 2개 추가. 접근성(label/id) 기존 패턴 유지.
- `REALRATE_기능명세서.md` §3(표에서 SALARY_TRANSFER/CARD_USAGE/FIRST_CUSTOMER 행에 "은행 특정" 표기 추가 또는 별도 부속 설명), §4(와이어프레임의 입력 패널·상세 카드 구성을 위 변경대로 갱신).

## Constraints

- 기존에 통과하던 계산 로직(clamp, bp 연산, 정렬 순서)은 그대로 보존한다 — 버킷 이름/개수만 바뀐다.
- 은행 비종속 5종(AUTO_TRANSFER, MARKETING_AGREE, NON_FACE_TO_FACE, LINKED_PRODUCT, APP_MISSION)의 동작·문구·판정 방식은 변경하지 않는다.
- 은행 API 연동, 급여이체 자동 확인은 하지 않는다(자기 신고 입력 전제).
- 은행명 선택지는 반드시 `data/products.json`의 실제 `companyName` 값과 코드 레벨에서 일치시킨다(하드코딩 목록 대신 상품 데이터에서 고유값을 뽑아 생성하는 것을 권장 — 오탈자/누락 방지).
- `notMet` 상태는 타입상 존재하되 이번 스코프에서 발생 경로가 없어도 무방하다(향후 확장 여지 확보 목적). 억지로 발생 경로를 만들 필요는 없다.
- 기존 회귀 테스트(`lib/my-rate.test.ts`, `lib/ranking.test.ts`, `lib/action-list.test.ts`, `lib/action-list-card.test.ts`, `lib/share-url.test.ts`)는 새 시그니처/필드명에 맞춰 갱신한다. 특히 `unapplied` → `notMet` 리네이밍은 전체 저장소에서 일괄 처리(잔존 참조 금지).

## Files To Inspect

- `lib/my-rate.ts` — `MyRateResult`, `calculateMyRate` 시그니처 변경 핵심
- `lib/ranking.ts:40` — 상품별 판정 함수 조립 지점
- `lib/action-list.ts` — 동일 판정 함수 재사용 필요
- `lib/calc-input.ts` — `CalcInput` 필드 추가, 헬퍼 함수 좁히기
- `lib/conditions.ts` — `CONDITION_META`에서 3종 문구/타입 구분 반영
- `lib/use-calc-input.ts` — 새 세터 훅
- `lib/share-url.ts` — 쿼리스트링 스키마 확장
- `app/_components/condition-panel.tsx` — 체크박스 8종 → 5종 + 은행 선택 UI 2개
- `app/_components/top-product-card.tsx` — "미확인" 섹션 + 개별 확인 체크박스
- `app/_components/calculator.tsx` — 위 컴포넌트들에 props 배선하는 상위 컴포넌트(변경 파급 확인)
- `lib/my-rate.test.ts`, `lib/ranking.test.ts`, `lib/action-list.test.ts`, `lib/action-list-card.test.ts`, `lib/share-url.test.ts`
- `data/products.json` — `companyName` 14종 정합성 확인용
- `REALRATE_기능명세서.md` §3, §4

## Acceptance Criteria

- [ ] `salaryTransferBank`를 A은행으로 설정해도, B은행 상품의 `myRateResult.applied`에 SALARY_TRANSFER가 포함되지 않는다(B는 `unconfirmed`에 위치).
- [ ] CARD_USAGE도 동일 기준(`cardUsageBank`)으로 상품별 상태가 갈린다.
- [ ] FIRST_CUSTOMER는 전역 입력 없이 항상 상품별 `unconfirmed`에서 시작하고, `productConditionOverrides`로만 `applied`가 된다.
- [ ] `TopProductCard`에서 `unconfirmed` 조건에 체크하면 해당 상품(`finPrdtCd`)에 한해 `applied`로 전환되고 내 금리가 재계산된다(다른 상품에는 영향 없음).
- [ ] "미충족 X" / "미확인 ?" 이 문구·스타일 모두에서 구분된다.
- [ ] `lib/my-rate.test.ts`가 `notMet`/`unconfirmed` 버킷과 새 `calculateMyRate` 시그니처에 맞춰 갱신되고 통과한다.
- [ ] `applied`+`notMet`+`unconfirmed`+`excluded` = `product.conditions` 전체(기존 `assertConditionPartition` 불변식이 4버킷 버전으로 유지).
- [ ] 은행 선택지 목록이 `data/products.json`의 `companyName` 14종과 정확히 일치한다(하드코딩 오탈자 없음).

## Verification

- [ ] `npm run typecheck` 통과.
- [ ] `node --test`(또는 프로젝트 테스트 스크립트) 전체 통과 — `my-rate`, `ranking`, `action-list`, `action-list-card`, `share-url` 테스트 포함.
- [ ] 수동 시나리오 1: 급여이체 은행을 A로 선택 → 랭킹 입력 조건(금액/기간)을 조정해 B은행 상품이 1위가 되도록 만든 뒤 `TopProductCard`에서 SALARY_TRANSFER가 "미확인"으로 표시되고 내 금리에 가산되지 않는지 확인. (제약: 상세 카드는 1위 상품에만 존재하므로 검증 시 순위 조정이 필요함)
- [ ] 수동 시나리오 2: 시나리오 1 상태에서 B은행 상품 상세의 SALARY_TRANSFER "미확인" 항목을 체크 → `applied`로 바뀌고 내 금리·세후이자가 증가하는지, 다른 상품에는 영향이 없는지 확인.
- [ ] 수동 시나리오 3: 아무 은행도 선택하지 않은 초기 상태에서 모든 상품의 SALARY_TRANSFER/CARD_USAGE/FIRST_CUSTOMER가 `unconfirmed`로만 나타나고 `applied`가 하나도 없는지 확인.
- [ ] `REALRATE_기능명세서.md` §3, §4 갱신 diff를 리뷰해 실제 UI 문구/구성과 일치하는지 확인.