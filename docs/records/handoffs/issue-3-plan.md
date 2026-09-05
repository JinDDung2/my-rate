## Goal

`lib/my-rate.ts` 순수 모듈을 만들어, **상품 1건 + 사용자가 선택한 만기/적립방식에 해당하는 옵션 1건 + 체크된 조건 집합**으로부터 내 금리를 산정한다. `myRate = baseRate + Σ(해당 상품이 제공하는, 사용자가 체크한 조건의 rateBp)`이며 `OTHER`와 `rateBp === 0`은 합산에서 제외하고, 결과는 그 옵션의 `maxRate`를 넘지 않도록 상한 클램프한다. 산정 결과와 함께 **적용 / 미적용 / 계산제외** 조건 목록을 #6·#7·#8 상세 화면이 그대로 쓸 수 있는 형태로 반환한다. T5~T7을 실제 테스트로 통과시킨다.

## Context

- **스펙 근거**: `REALRATE_기능명세서.md:102-109`(F-03), `:39-53`(§3 — `OTHER`는 내 금리에 절대 가산 금지), `:153-189`(§6 데이터 모델), `:218-228`(§7.5 T5~T7), `:242-247`(§8.2 — 규칙 3 `rateBp === 0`은 표시만, 규칙 4 `unexplainedBp` 정의), `:259-266`(§9 — 계산은 클라이언트 순수 모듈, 테스트가 같은 모듈을 직접 호출).
- **이슈 #1·#2 결과 위에 쌓는다 (저장소 확인함)**. `lib/types.ts:26-53`에 도메인 모델이, `lib/calc-input.ts:4-13`에 `CalcInput`·`CheckableConditionCode`가, `lib/conditions.ts:13-55`에 §3 라벨 맵과 `CHECKABLE_CONDITION_CODES`가 이미 있다. **전부 재사용하고 새로 만들지 않는다.**
- **입력 상태는 이미 있다**: `useCalcInput()`이 `{ monthlyAmount, termMonths, reserveType, selectedConditions }`를 커밋된 값으로 제공한다(`lib/use-calc-input.ts`). `selectedConditions`는 `CONDITION_CODES` 순서로 정렬된 배열이고 `OTHER`는 타입 레벨에서 배제되어 있다.
- **이 이슈는 이자를 계산하지 않는다.** `lib/interest.ts`(#4)와 랭킹(#5)이 아직 없다. #3의 출력은 금리(%)와 조건 목록까지다.

### 데이터 실측 (`data/products.json`, 43상품 / 135옵션 / 기준월 202608)

이 5가지가 설계를 결정한다.

1. **`(상품, 만기, 적립방식)` → 옵션은 항상 0개 또는 1개다.** 43상품 × 4만기 × 2적립방식 전수 확인 결과 2개 이상 매칭되는 조합은 **0건**. 옵션 선택에 타이브레이커가 필요 없다.
2. **`baseRate`/`maxRate`는 옵션마다 다르고, 우대갭도 옵션마다 다를 수 있다.** 4개 상품(`01020400490002` 90/55bp, `01020400660001` 200/220bp, `010200100051` 90/100/120bp, `010200100084` 100/90/80bp)에서 옵션별 갭이 갈린다. → **내 금리는 상품 단위가 아니라 옵션 단위로 계산해야 하고, 클램프 기준도 그 옵션의 `maxRate`다.**
3. **부동소수점이 실제로 깨진다.** `rate * 100`이 정수가 아닌 경우 **39건**(`2.45*100 = 245.00000000000003`, `2.3*100 = 229.99999999999997`, `4.6*100 = 459.99999999999994`). 순진하게 `baseRate + sum/100`으로 더하면 bp 정수 경로와 **14건**에서 값이 갈린다(`3.2 + 10/100 = 3.3000000000000003`). → **bp 정수 산술이 선택이 아니라 필수다.**
4. **한 상품 안에 같은 코드가 중복 등장한다** (4상품). 예: `010200100070` KB내맘대로적금은 `AUTO_TRANSFER` 2행(각 10bp), `010200100084`는 `APP_MISSION` 3행. → 합산 의미론을 반드시 정해야 한다(설계 결정 2).
5. **`OTHER`인데 `rateBp !== 0`인 조건이 34건 있다.** `OTHER` 제외 규칙이 장식이 아니라 실제로 금리를 바꾼다. 반대로 **`OTHER`가 아니면서 `rateBp === 0`인 조건은 현재 0건**이다(규칙은 구현하되 현재 데이터로는 커버되지 않음).

### T5~T7 실데이터 적합성 (미리 확인함)

- **T5 (상한 클램프)** — 실제로 터지는 상품이 **정확히 1개** 있다: `010200100070` **국민은행 KB내맘대로적금**. 계산 대상 조건 합 70bp(SALARY 10 + CARD 10 + AUTO 10 + AUTO 10 + NON_FACE 10 + FIRST 10 + LINKED 10), 우대갭은 4개 옵션 모두 60bp. 12개월/정액 옵션 기준 `base 2.55 → 미클램프 3.25 → 클램프 3.15(= maxRate)`.
- **T6 (조건 0개)** — 아무 상품이나 가능. 조건이 아예 비어 있는 상품도 2건, 계산 가능한 조건이 0개인 상품이 14건 있다.
- **T7 (unexplainedBp > 0 → maxRate 미도달)** — `unexplainedBp > 0`인 상품은 8건인데 **8건 전부 계산 가능한 조건 합이 0bp다.** 즉 실데이터로는 "조건을 전부 선택해도 `myRate == baseRate < maxRate`"라는 **자명한 형태로만 통과한다.** 우대폭이 실제로 가산되면서 동시에 미해석분이 남는 상품은 현재 데이터에 없다. → **실데이터 케이스와 합성 픽스처를 둘 다 둘 것**(검증 3-c).

### `unexplainedBp`에 대한 경고 (건드리지 말 것)

`scripts/lib/pipeline.ts:69-84`가 `unexplainedBp = max(0, 갭bp − Σ rateBp)`를 계산하는데, 이때 Σ에 **`OTHER`를 포함**하고 갭은 **`getRepresentativeOption()`이 고른 갭 최대 옵션 1개**(`pipeline.ts:7-18`) 기준이다. 결과적으로 `unexplainedBp`는 (a) 내 금리 합산 대상(`OTHER` 제외)과 분모가 다르고, (b) 사용자가 고른 옵션의 갭과 일치하지 않을 수 있다(위 실측 2의 4상품). **#3은 `unexplainedBp`를 읽지도, 재계산하지도, 가산하지도 않는다.** 이 불일치는 F-09/이슈 #8의 문제이므로 그쪽에 남긴다.

### 테스트 러너 부재 — 이 이슈에서 해결한다

`package.json`에 `test` 스크립트가 없다. 이슈 #2 핸드오프는 "테스트 러너 도입은 #4 소관"으로 미뤘지만, **#3의 Verification이 T5~T7 테스트를 요구하므로 #3이 먼저 필요해졌다.** Node v26.3.1 + `tsx` 4.23(devDependency)이 이미 있으므로 **새 의존성 0개로 `node --test`를 붙일 수 있다.** #4가 T1~T4에 그대로 재사용한다.

## Constraints

### 반드시 지킬 것

1. **모든 금리 산술은 basis point 정수로 한다.** 경계에서 `Math.round(rate * 100)`으로 bp 정수화하고, 합·클램프를 정수로 끝낸 뒤 마지막에 한 번만 `/ 100`으로 % 복원한다. `baseRate + rateBp / 100` 같은 실수 누적을 어디에도 쓰지 않는다. (실측 3: 39건이 `*100`에서 깨지고 14건이 실제로 값이 갈린다. `docs/agents/development.md:17` "금융 계산은 부동소수점 오차를 피하고 정수 타입을 검토한다"와도 일치.)
2. **계산 단위는 `(Product, RateOption)` 쌍이다.** `RateOption`을 인자로 받고, 클램프는 **그 옵션의 `maxRate`** 로 한다. 상품 단위 대표 금리를 만들어 클램프하지 않는다(실측 2).
3. **합산 제외 규칙을 정확히 두 가지로 한다**: `code === 'OTHER'` 이거나 `rateBp === 0`인 조건은 **합계에 넣지 않는다.** 단, **화면에서는 사라지면 안 된다** — 별도 버킷으로 반환한다(설계 결정 3). `OTHER`는 `rateBp`가 0이 아니어도 절대 가산 금지(`기능명세서:53`).
4. **사용자가 체크했더라도 그 상품이 제공하지 않는 조건은 가산하지 않는다.** 매칭 기준은 `product.conditions[].code`다.
5. **클램프는 양방향 안전하게**: `myRateBp = max(baseBp, min(baseBp + sumBp, maxBp))`. 현재 데이터에 `maxRate < baseRate`인 옵션은 없지만, 단순 `min`만 쓰면 그런 데이터가 들어올 때 내 금리가 기본금리 아래로 내려간다.
6. **`lib/types.ts`와 `data/products.json`을 수정하지 않는다.** `lib/types.ts`는 §6 데이터 모델의 미러이고, `data/products.json`은 파이프라인 산출물이다. 계산 결과 타입은 `lib/my-rate.ts`에 둔다.
7. **`lib/calc-input.ts` / `lib/conditions.ts` / `lib/use-calc-input.ts`의 기존 공개 시그니처를 바꾸지 않는다.** `CheckableConditionCode`·`CONDITION_META`·`CHECKABLE_CONDITION_CODES`를 **재사용**한다. 조건 라벨 맵을 다시 만들지 않는다.
8. **`lib/my-rate.ts`는 React·Next 의존이 0이어야 한다.** `'use client'` 없이, import 대상은 `lib/types.ts`·`lib/calc-input.ts`·`lib/conditions.ts`뿐. §9가 "테스트에서 동일 모듈을 직접 호출"을 요구한다.
9. **새 런타임 의존성 0개.** 테스트 러너는 `node --test`(내장) + 기존 `tsx`만 쓴다. `jest`/`vitest`를 추가하지 않는다.
10. **결과는 결정적이어야 한다.** 적용/미적용 목록의 정렬 순서를 `CONDITION_CODES`(`lib/types.ts:14-24`) 순서 → 동일 코드 내에서는 `product.conditions` 원본 순서로 고정한다. 체크 순서에 따라 목록 순서가 달라지면 안 된다.
11. **`npm run build`의 `check:reviewed` 게이트(`package.json:13`)를 건드리지 않는다.**
12. **네트워크 호출·서버 로깅 0건**(§10). 조건 계산은 전부 클라이언트/순수 함수다.

### 범위 밖 (하지 말 것)

- 이자·세금·만기수령액 계산(#4 `lib/interest.ts`). #3의 출력은 금리와 조건 목록까지다.
- 랭킹 테이블·정렬·필터 UI(#5), 1위 상세 카드(#6), 액션 리스트 시뮬레이션(#7), `evidence` 원문 토글·`AI 해석` 배지·미해석 우대폭 고지 문구(#8).
- `unexplainedBp` 재계산·데이터 재빌드·추출 파이프라인 수정. 위 "경고" 참조 — 발견 사실만 기록하고 코드는 손대지 않는다.
- URL 직렬화(#11), 자연어 입력(#10).
- 자유적립식의 실제 납입 패턴 모델링(§7.4에서 정액 가정으로 고정, #4 소관).

### 설계 결정 (가정 — 다르게 가려면 먼저 알릴 것)

1. **모듈 위치·이름은 `lib/my-rate.ts`.** §9가 이자 엔진을 `lib/interest.ts`로 못박았으므로 금리 산정은 별 모듈로 분리해 #4와 충돌하지 않게 한다.
2. **같은 코드가 여러 행이면 전부 합산한다(sum-all-entries).** dedup(코드별 max)로 가면 `010200100070`의 합이 60bp가 되어 갭 60bp와 같아지고, **데이터셋 전체에서 클램프가 한 번도 발동하지 않아 T5의 실데이터 픽스처가 사라진다.** 스펙 문언(`Σ 해당 상품이 제공하는 조건의 rate_bp`)의 직독과도 일치한다. 대신 UI에서 "자동이체" 체크 하나가 2행으로 보이는 문제는 #6이 코드 단위로 묶어 표시하면 되므로, **반환 목록에는 원본 행을 그대로 담고 합치지 않는다.**
3. **반환 목록은 2버킷이 아니라 3버킷으로 한다.**
   - `applied` — 사용자가 체크 + 상품이 제공 + 계산 대상 → 실제로 가산된 행
   - `unapplied` — 상품이 제공 + 계산 대상 + 사용자가 체크하지 않음 (= §4 [C]의 `미충족 X` 목록)
   - `excluded` — `OTHER`이거나 `rateBp === 0`이라 계산에서 빠진 행 (= §4 [C]의 정보 표시 영역, F-08/F-09 입력)

   이슈 AC는 "적용/미적용" 2개만 말하지만, `excluded`를 `unapplied`에 섞으면 #6이 "체크하면 오르는 조건"과 "체크해도 안 오르는 조건"을 구분할 수 없고 #7의 액션 리스트가 0원짜리 항목을 제안하게 된다. 3버킷이 AC "상세 화면에서 사용할 수 있는 형태"의 실질이다.
4. **사용자가 체크했지만 상품이 제공하지 않는 조건은 어느 목록에도 넣지 않는다.** 그 조건에는 이 상품 기준의 `label`·`rateBp`·`evidence`가 존재하지 않아 채울 값이 없다. 사용자가 무엇을 체크했는지는 이미 [A] 패널이 보여준다.
5. **각 목록의 원소는 `SpecialCondition`을 그대로 담는다** (`{ code, label, rateBp, evidence, confidence }`). 새 DTO로 재포장하지 않는다 — #8이 `evidence`와 `confidence`를 그대로 필요로 한다.
6. **반환 타입은 `%`와 `bp`를 둘 다 노출한다.** `myRate`(% 표시용), `myRateBp`(정수, #5 정렬·#7 증감분 계산이 오차 없이 쓸 값), `baseRate`/`maxRate`(옵션 값 그대로), `appliedBp`(가산된 합), `clamped: boolean`, `clampedAwayBp`(클램프로 잘려나간 bp — #6이 "상한에 걸렸습니다"를 설명할 때 필요). 하위 이슈가 `%`를 다시 bp로 되돌리는 순간 실측 3의 오차가 재발하므로 정수를 함께 준다.
7. **옵션 조회 헬퍼를 같은 모듈에 둔다**: `findRateOption(product, termMonths, reserveType): RateOption | null`. 매칭이 없으면 **예외를 던지지 말고 `null`을 반환**한다 — 6개월/정액은 43상품 중 5건만 존재해서 미매칭이 정상 상태다. #5의 필터가 이 `null`을 그대로 소비한다.
8. **관측 가능한 임시 출력을 `app/_components/calculator.tsx`에 최소한으로 추가한다.** 이슈 #2가 남긴 "커밋된 입력 요약" 블록 옆에, 선택한 만기/적립방식에 매칭되는 상품 몇 건과 그중 내 금리 상위 몇 건을 `기본 x.xx% → 내 금리 y.yy%` 형태로 텍스트 표시한다. **이자·세후금액은 표시하지 않는다(#4 침범).** `{/* 임시: 이슈 #5 랭킹 테이블로 대체 */}` 주석을 반드시 남긴다. 이슈 #2의 임시 출력 선례를 그대로 따른다.

### 알려진 함정

- **`Math.round(rate * 100)`을 빼먹은 곳이 하나라도 있으면 조용히 틀린다.** `2.45 * 100 = 245.00000000000003`이라 `Math.trunc`/`parseInt`/`| 0`으로 정수화하면 **244**가 된다. 반드시 `Math.round`다.
- **`unexplainedBp`를 "남은 우대폭"으로 오해해서 더하지 말 것.** 정의상 미반영분이다(`기능명세서:35`, `:135-136`).
- **클램프를 `Math.min(myRate, maxRate)`로 % 단계에서 하면 안 된다.** `3.2500000000000004 > 3.25`류 비교로 없어야 할 클램프가 발동하거나 반대로 놓친다. 비교도 bp 정수로.
- **빈 `conditions` 배열 상품이 2건 있다.** `reduce` 초기값 누락·`conditions[0]` 접근 같은 가정을 두지 말 것.
- **`tsx`의 `@/` 경로 별칭이 `node --test` 경로에서 해석되지 않을 수 있다.** 검증 1에서 가장 먼저 확인하고, 실패하면 **테스트 파일에서만 상대경로 import로 폴백**한다. 이 때문에 `tsconfig.json`의 `paths`나 프로덕션 코드의 import 스타일을 바꾸지 말 것.
- **`tsconfig.json`의 `include`가 `**/*.ts`라 테스트 파일도 타입체크 대상이다.** 이건 의도된 것이니 그대로 두되, 테스트 파일이 `npm run typecheck`를 깨지 않게 할 것.
- **`data/products.json`을 테스트 픽스처로 직접 읽으면 다음 데이터 갱신 때 T5가 깨진다.** 실데이터 케이스는 `finPrdtCd`로 찾되 **없으면 실패가 아니라 명시적으로 skip**하고, 클램프 로직 자체는 별도 합성 픽스처로 무조건 검증한다.
- **커밋은 요청이 있을 때만 한다**(`docs/agents/development.md:23`).

## Files To Inspect

**읽을 것**

- `REALRATE_기능명세서.md:39-53, 102-109, 153-189, 218-228, 242-247, 259-266` — §3 조건 코드, F-03, §6 데이터 모델, §7.5 T5~T7, §8.2 검증 규칙, §9 API/모듈 경계
- `docs/github-issues/03-my-rate-calculation.md` — 이슈 원문
- `docs/github-issues/04-interest-engine.md`, `05-ranking-table.md`, `06-top-product-detail.md`, `07-action-list-simulation.md`, `08-evidence-and-unexplained-rate.md` — 이 반환 타입을 소비할 이슈들. 3버킷 결정의 근거
- `lib/types.ts:1-58` — `ConditionCode`, `CONDITION_CODES`, `SpecialCondition`, `RateOption`, `Product`
- `lib/calc-input.ts:1-30` — `CalcInput`, `CheckableConditionCode`, `TermMonths`, `ReserveType`
- `lib/conditions.ts:13-55` — `CONDITION_META`, `CHECKABLE_CONDITION_CODES`
- `lib/use-calc-input.ts`, `app/_components/calculator.tsx` — 커밋된 입력이 나오는 지점과 임시 출력을 붙일 자리
- `scripts/lib/pipeline.ts:7-33, 69-84` — `unexplainedBp`·`gapToBp`의 실제 정의. **읽되 수정하지 않는다**
- `docs/records/handoffs/issue-2-plan.md`, `docs/records/2026-09-05-condition-input-panel-verification.md` — 앞 이슈의 결정·기록 형식
- `docs/agents/development.md` — 순수 함수 분리, 정수 산술, 커밋 규칙

**새로 만들 것 (제안)**

- `lib/my-rate.ts` — 순수 모듈.
  - `toBp(rate: number): number` = `Math.round(rate * 100)` (내부 유틸, export해서 테스트)
  - `isCountable(condition: SpecialCondition): boolean` = `code !== 'OTHER' && rateBp !== 0`
  - `findRateOption(product, termMonths, reserveType): RateOption | null`
  - `calculateMyRate(product: Product, option: RateOption, selected: readonly CheckableConditionCode[]): MyRateResult`
  - `interface MyRateResult { myRate: number; myRateBp: number; baseRate: number; maxRate: number; appliedBp: number; clamped: boolean; clampedAwayBp: number; applied: SpecialCondition[]; unapplied: SpecialCondition[]; excluded: SpecialCondition[] }`
- `lib/my-rate.test.ts` — T5·T6·T7 + `OTHER` 제외 + 미제공 조건 제외 + 중복 코드 합산 + bp 정수 산술 + `findRateOption` 미매칭. 실데이터(`data/products.json`)와 합성 픽스처를 함께 사용.

**수정할 것**

- `package.json` — `"test": "node --import tsx --test lib/**/*.test.ts"` 추가. **dependencies는 변경 없음.**
- `app/_components/calculator.tsx` — 임시 내 금리 readout 추가(설계 결정 8). 기존 입력 요약 블록과 `<ProductList />`는 그대로 둔다.

## Acceptance Criteria

- [ ] `lib/my-rate.ts`가 React·Next를 import하지 않는 순수 모듈이고, `node --import tsx --test`로 직접 호출된다.
- [ ] 조건 0개 선택 시 모든 상품·모든 옵션에서 `myRate === baseRate`이고 `myRateBp === toBp(baseRate)`이다.
- [ ] 체크 가능한 8종을 전부 선택해도 모든 상품·모든 옵션에서 `myRate <= maxRate`이다.
- [ ] `010200100070`(국민은행 KB내맘대로적금) 12개월/정액 옵션에서 8종 전부 선택 시 `clamped === true`, `myRate === 3.15`(= `maxRate`), `clampedAwayBp === 10`이다.
- [ ] 같은 상품에서 `OTHER` 2행(각 10bp)이 합산되지 않는다 — 미클램프 합이 90bp가 아니라 70bp다.
- [ ] `MARKETING_AGREE`·`APP_MISSION`을 체크해도 위 상품의 `myRate`가 변하지 않는다(상품이 제공하지 않는 조건).
- [ ] `AUTO_TRANSFER` 하나를 체크하면 `010200100070`에서 `applied`에 2행이 들어가고 20bp가 가산된다(설계 결정 2대로 동작).
- [ ] `rateBp === 0`인 조건은 `applied`/`unapplied` 어디에도 없고 `excluded`에 있다.
- [ ] `applied` + `unapplied` + `excluded`의 합집합이 `product.conditions` 전체와 정확히 일치하고, 세 목록이 서로소다(어떤 조건도 누락·중복되지 않는다).
- [ ] `applied`/`unapplied`/`excluded` 각 목록이 `CONDITION_CODES` 순서로 정렬되어 있고, 사용자의 체크 순서를 바꿔도 동일한 배열이 나온다.
- [ ] 각 목록의 원소가 `label`·`rateBp`·`evidence`·`confidence`를 그대로 갖는다(#6·#8이 추가 조회 없이 렌더 가능).
- [ ] `unexplainedBp`가 `myRate`에 가산되지 않는다. `unexplainedBp > 0`인 8개 상품 전부에서 8종 전부 선택 시 `myRate < maxRate`이다.
- [ ] `baseRate = 3.2`, 조건 `10bp` 케이스에서 `myRate`가 `3.3000000000000003`이 아니라 `3.3`이다(bp 정수 경로 확인).
- [ ] `findRateOption`이 매칭 없을 때 예외 없이 `null`을 반환한다(예: 6개월/정액 옵션이 없는 상품).
- [ ] `lib/types.ts`, `data/products.json`, `lib/calc-input.ts`, `lib/conditions.ts`가 수정되지 않았다.
- [ ] `package.json`의 `dependencies`·`devDependencies`가 변하지 않았다(추가된 것은 `test` 스크립트뿐).
- [ ] `npm test`, `npm run typecheck`, `npm run build`가 전부 통과한다.

## Verification

Codex가 실행하고 결과를 기록할 것.

1. **테스트 러너 배선 먼저 확인.** `npm test`가 `lib/my-rate.test.ts`를 실제로 집어 드는지, `@/` 별칭이 해석되는지 확인한다. 별칭이 깨지면 **테스트 파일만 상대경로로 폴백**하고 그 사실을 리포트에 남긴다(`tsconfig.json`·프로덕션 import는 그대로).
2. `npm run typecheck` — 테스트 파일 포함 통과 로그 첨부.
3. **T5~T7 (§7.5 필수)**
   - **T5 상한 클램프** — 실데이터: `010200100070` × `{saveTrm:12, rsrvType:'S'}`, 8종 전부 선택 → `myRate === 3.15`, `clamped === true`, `clampedAwayBp === 10`. 나머지 3개 옵션(6/24/36개월)에서도 `myRate === maxRate`. 합성: 갭보다 조건 합이 훨씬 큰 픽스처로 클램프 자체를 독립 검증.
   - **T6 조건 0개** — 43상품 × 전 옵션 루프로 `myRate === baseRate` 전수 확인. `conditions`가 빈 2개 상품도 포함할 것.
   - **T7 미해석 우대폭** — `unexplainedBp > 0`인 8개 상품 전 옵션에서 8종 전부 선택 시 `myRate < maxRate`. **주의: 이 8건은 계산 대상 조건 합이 0bp라 자명하게 통과한다.** 따라서 `baseRate` + 가산되는 조건 + 남은 미해석분이 동시에 존재하는 **합성 픽스처를 반드시 추가**해서 "가산은 되지만 maxRate에는 못 미친다"를 진짜로 검증할 것.
4. **전수 불변식 테스트** (43상품 × 135옵션 × 조건 부분집합 일부):
   - 모든 경우에 `baseRate <= myRate <= maxRate`.
   - `applied`/`unapplied`/`excluded`가 서로소이고 합집합이 `product.conditions`와 같다.
   - `appliedBp === applied.reduce((a, c) => a + c.rateBp, 0)`.
   - `clamped === (toBp(baseRate) + appliedBp > toBp(maxRate))`.
5. **부동소수점 회귀 테스트** — `baseRate` 목록 `[2.2, 2.3, 2.45, 3.2, 3.05, 2.55]`에 각각 `10~70bp`를 더해 결과가 `x.xx` 2자리로 정확히 떨어지는지 확인. 하나라도 `...0000003`/`...9999997`이 나오면 실패.
6. `npm run build` — `check:reviewed`가 `next build`보다 먼저 실행되는지 확인.
7. **수동 확인** — `npm run dev` 후 조건 체크박스를 켜고 끌 때 임시 readout의 내 금리가 즉시 바뀌는지, 만기/적립방식을 바꾸면 매칭 상품 수와 금리가 함께 바뀌는지 확인. `010200100070`(국민은행 KB내맘대로적금)을 12개월/정액에서 찾아 8종 전부 체크 → 3.15%에서 더 오르지 않는 것을 눈으로 확인(스크린샷 첨부). DevTools Network에 새 요청이 없어야 한다(최초 `/api/products` 1회 제외).
8. **범위 유지 확인** — 임시 readout에 이자·세금·세후금액이 없고, `git diff --stat`에 `lib/types.ts`·`data/products.json`·`scripts/**`가 없어야 한다.

**리포트에 남길 것**: 실행한 검증과 결과, 테스트 러너 배선에서 `@/` 별칭이 통했는지, "설계 결정" 중 다르게 간 항목과 이유, T7 합성 픽스처의 구체적 수치, 그리고 Context의 **`unexplainedBp` 정의 불일치**(`OTHER` 포함 합산 + 갭 최대 옵션 기준)를 이슈 #8로 올릴지 여부.