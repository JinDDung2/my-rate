# Ranking Table Verification

Issue #5 adds the pure ranking module and replaces the temporary calculator preview with the result table.

## Implementation

- Added `buildRanking(products, input)` in `lib/ranking.ts`.
- The module combines `findRateOption`, `calculateMyRate`, and `calculateInterest` without React or Next imports.
- Products are included only when `findRateOption(product, input.termMonths, input.reserveType)` returns a matching option.
- `myRateBp` is converted to the interest module's decimal annual rate with `myRateBp / 10000`.
- The matched option's `intrRateType` is passed through as `interestType`.
- Ranking rows are sorted by:
  - `afterTaxInterest` descending
  - matched `option.baseRate` descending
  - `finPrdtCd` ascending with direct string comparison for deterministic, locale-independent final order
- The UI renders a semantic table with `caption` and `th scope="col"`, and uses horizontal overflow for narrow screens.

## Decisions

- Period filtering uses period plus reserve type matching, not period alone. This keeps ranking behavior aligned with the input panel and the existing my-rate option lookup.
- `세후실수령` is interpreted as after-tax interest, not maturity amount, because the glossary defines `실수령 이자` as maturity interest minus 15.4% tax. Maturity amount remains out of scope for #6 detail UI.
- `광고금리` uses the matched option's `maxRate`; `내금리` uses `calculateMyRate(...).myRate`.
- The row keeps `option`, `myRateResult`, and full `interest` objects in addition to display fields so #6/#7 can reuse the same calculation output without re-running lower-level logic.
- Review follow-up removed `localeCompare` from the final tie-breaker and changed the test assertion to direct code-point order. The test suite also now covers the `reserveType: 'F'` path and the no-match `[]` module result.

## Verification Results

- `npm test` passed: 33 tests, 33 pass. The runner picked up `lib/ranking.test.ts`, `lib/my-rate.test.ts`, and `lib/interest.test.ts`.
- `npm run typecheck` passed.
- `npm run build` first failed inside the sandbox because `tsx` could not listen on its temp IPC pipe. Running the same command outside the sandbox passed. The log showed `check:reviewed` before `next build`, with `검수 완료 확인: 전 43건 reviewed: true`.
- `npm run dev -- --port 3001` first failed inside the sandbox because localhost listen was denied. Running outside the sandbox served `http://localhost:3001`; `curl -I /` returned `200 OK`, and `GET /api/products` returned disclosure month `202608` with 43 products.
- Browser automation packages were not installed in this worktree, so a 375px screenshot/click test was not available. A direct `buildRanking` smoke check with real data confirmed period changes alter row counts and order:
  - 6 months fixed: 5 rows
  - 12 months fixed: 12 rows
  - 24 months fixed: 7 rows
  - 36 months fixed: 7 rows
- The same smoke check confirmed condition changes alter the leader for 12 months fixed: no conditions led with `10-01-30-031-0036` at `3.60%` / `98,982` after-tax interest; all checkable conditions led with `TD11330030000` at `4.10%` / `112,730`.
- `git diff --stat HEAD` scope check passed after reverting the generated `next-env.d.ts` change: only `lib/ranking.ts`, `lib/ranking.test.ts`, `app/_components/ranking-table.tsx`, `app/_components/calculator.tsx`, and this record changed.

## Notes For Follow-Up Issues

- F-06 can compare the advertisement-rate leader with `buildRanking(...)[0]`. The ranking output contains the data needed to detect when the advertised top product differs from the user's after-tax-interest leader.
