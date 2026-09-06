# Action List Verification

Issue #7 adds the `[D] 액션 리스트` card below the top-product detail card.

## Implementation

- Added `buildActionList(product, option, input)` in `lib/action-list.ts`.
- The module has no React or Next dependency.
- The baseline is recalculated inside `buildActionList` with `calculateMyRate(product, option, input.selectedConditions)`.
- Baseline and scenario interest both use the ranking convention:
  - `annualRate = myRateResult.myRateBp / 10000`
  - `interestType = option.intrRateType`
- Candidate conditions come only from `baselineMyRate.unapplied`.
- Duplicate unmet condition rows are deduplicated by condition code.
- `rateBp` on the returned item is the sum of baseline unmet rows for that code.
- Each simulation uses exactly `input.selectedConditions` plus one candidate code.
- Rows with `afterTaxInterestDelta <= 0` are removed.
- Returned rows are sorted by:
  - `afterTaxInterestDelta` descending
  - `CONDITION_CODES` order ascending for ties
- The list is capped at 3 rows.
- Added `ActionListCard` and rendered it after `TopProductCard` when ranking rows exist and products loaded successfully.
- The card finds the source `Product` with `rankingRows[0].finPrdtCd`, calls `buildActionList(product, rankingRows[0].option, input)`, and returns `null` when the product or action rows are absent.

## Decisions

- A1 is kept: the target product is the user's current after-tax-interest leader, `rankingRows[0]`. There is no selected-product route yet. The extension point is already present because `buildActionList` accepts arbitrary `(product, option, input)`.
- A2 is kept: if all conditions are already satisfied or all candidate deltas are clamped to 0, the card renders nothing.
- The UI text follows the handoff format `{label}를 추가하면 +{formatKrw(delta)}원`.
- Combination simulation is intentionally absent. Tests compare the single-condition delta against a multi-condition scenario to guard this.
- Evidence source text and selected-product UI remain out of scope for this issue.

## Real Data Smoke

Input:

```json
{
  "monthlyAmount": 500000,
  "termMonths": 12,
  "reserveType": "S",
  "selectedConditions": []
}
```

Top ranking row:

```json
{
  "finPrdtCd": "10-01-30-031-0036",
  "companyName": "전북은행",
  "productName": "JB 다이렉트적금(정액적립식)",
  "baseRate": 3.6,
  "maxRate": 3.7,
  "myRateBp": 360,
  "afterTaxInterest": 98982,
  "unapplied": [
    {
      "code": "AUTO_TRANSFER",
      "label": "당행 계좌 자동이체 6회 이상 입금",
      "rateBp": 10
    }
  ]
}
```

Action list:

```json
[
  {
    "code": "AUTO_TRANSFER",
    "label": "자동이체",
    "rateBp": 10,
    "afterTaxInterestDelta": 2750
  }
]
```

Manual cross-check:

- Baseline: `P=500000`, `n=12`, `r=0.036`, simple interest.
- Pretax interest: `500000 * (0.036 / 12) * 12 * 13 / 2 = 117000`.
- Tax: `floor(117000 * 0.154) = 18018`.
- After-tax interest: `117000 - 18018 = 98982`.
- Add `AUTO_TRANSFER`: `myRateBp=370`, `r=0.037`.
- Pretax interest: `500000 * (0.037 / 12) * 12 * 13 / 2 = 120250`.
- Tax: `floor(120250 * 0.154) = 18518`.
- After-tax interest: `120250 - 18518 = 101732`.
- Delta: `101732 - 98982 = 2750`.

## Verification Results

- `npm test` passed: 52 tests, 52 pass. The runner included `lib/action-list.test.ts`, `lib/action-list-card.test.ts`, `lib/ranking.test.ts`, and `lib/top-product-card.test.ts`.
- `npm run typecheck` passed.
- `npm run build` first failed in the sandbox because `tsx` could not listen on its temp IPC pipe. After installing local dependencies for this worktree with `npm install`, re-running `npm run build` outside the sandbox passed. The log showed `check:reviewed` before `next build`, with `검수 완료 확인: 전 43건 reviewed: true`.
- `npm run dev -- --port 3001` served `http://localhost:3001`.
- `curl -I http://localhost:3001/` returned `200 OK`.
- `GET http://localhost:3001/api/products` returned `200 OK`, disclosure month `202608`, and 43 products.
- Direct calculation smoke for condition changes:
  - No selected conditions: leader `10-01-30-031-0036`, actions `[AUTO_TRANSFER]`.
  - `AUTO_TRANSFER` selected: same leader, actions `[]`; the listed action disappears.
  - All checkable conditions selected: leader `TD11330030000`, actions `[]`; the card would disappear.
- `lib/action-list.test.ts` covers:
  - 5 unique unmet conditions capped to 3 and sorted by delta
  - baseline already clamped at `maxRate`
  - partial clamp with positive effective delta
  - duplicate unmet rows deduplicated by code with summed `rateBp`
  - already selected conditions kept while measuring one additional code
  - equal delta tie-break by `CONDITION_CODES`
  - baseline interest alignment with `buildRanking`
- `lib/action-list-card.test.ts` covers:
  - `+` prefix and thousands-formatted won amounts
  - maximum 3 rendered action rows
  - rendered order
  - empty ranking, missing product, and fully satisfied conditions returning empty markup
