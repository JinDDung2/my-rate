# My Rate Calculation Verification

Issue #3 adds the pure my-rate calculation module and temporary calculator readout. This note records the review follow-up fixes and verification results.

## Fixes

- `clampedAwayBp` now reports the bp actually removed by the final clamp: `max(0, unclampedRateBp - myRateBp)`. `clamped` intentionally keeps the Verification 4 formula, `baseBp + appliedBp > maxBp`.
- The selected condition lookup is now `Set<ConditionCode>` instead of `Set<string>`.
- `ProductsState` is derived from `ProductsLoadState & { reload }` so the three load-state variants are not hand-maintained twice.
- `Calculator` narrows the rate-preview memo dependencies to `products.status` and `products.data`, avoiding invalidation from the hook's wrapper object.
- Tests now cover malformed `maxRate < baseRate` data, reserve-type matching, `clampedAwayBp` invariants, bp-based expectations, and string-level floating-point regressions.
- The preview screenshot was moved under `docs/records/assets/` so it is referenced by a work record instead of living as an unreferenced top-level asset.

## Decisions

- `ProductList` continues to receive the already loaded `products` state from `Calculator`. This changes its public component signature, but it prevents a second `/api/products` request after `Calculator` also needs the same data for the temporary readout.
- The temporary readout still shows only the top 3 matching products. With all eight conditions checked, `010200100070` is clamped to 3.15% in tests but is not necessarily visible in the top 3 browser preview.
- Tests use relative imports. The `node --import tsx --test lib/**/*.test.ts` runner picked up `lib/my-rate.test.ts` directly; no production path alias change was needed.
- T7 synthetic fixture uses `baseRate 2.30%`, `maxRate 3.20%`, `SALARY_TRANSFER 20bp`, `OTHER 40bp`, and `unexplainedBp 80bp`. The result is `appliedBp 20`, `myRate 2.50%`, still below `maxRate`.
- The known `unexplainedBp` mismatch remains for issue #8: pipeline calculation includes `OTHER` in the source sum and uses the representative max-gap option, while my-rate calculation excludes `OTHER` and uses the selected option.

## Verification

- `npm test` passed: 15 tests, 15 pass. This covers T5/T6/T7, lower-bound clamping, zero-rate exclusion, duplicate condition rows, deterministic partitions, `findRateOption` null return, and reserve-type matching.
- `npm run typecheck` passed.
- `npm run build` first failed inside the sandbox because `tsx` could not listen on its temp IPC pipe. Rerunning outside the sandbox passed. The log showed `npm run check:reviewed` before `next build`, with `검수 완료 확인: 전 43건 reviewed: true`.
- Chrome DevTools Protocol against `npm run dev -- --port 3001` confirmed the temporary readout is present, all 8 condition checkboxes can be selected, term and reserve-type changes update the committed summary/readout, and no new requests are emitted during interactions. In `next dev`, the initial `/api/products` request count was 2 due development remount behavior; interaction requests were `[]`.
- 390px preview screenshot: [2026-09-06-issue-3-my-rate-preview.png](assets/2026-09-06-issue-3-my-rate-preview.png).

## Scope Check

- The temporary readout contains only rates and matching product count. It does not show interest, tax, or after-tax maturity amount.
- `lib/types.ts`, `data/products.json`, `lib/calc-input.ts`, `lib/conditions.ts`, and `scripts/**` were not modified in the review follow-up.
- `package.json` dependencies and devDependencies were not changed.
