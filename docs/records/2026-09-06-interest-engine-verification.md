# Interest Engine Verification

Issue #4 adds the pure interest calculation module.

## Implementation

- Added `calculateInterest(params)` in `lib/interest.ts`.
- The module imports only `RateOption` as a type and exports `calculateInterest`, `InterestParams`, and `InterestResult`.
- `interestType` reuses `RateOption['intrRateType']`; `rsrvType` is intentionally not an input.
- `TAX_RATE` is fixed at `0.154`.
- `months <= 0` or `monthlyDeposit <= 0` returns zero interest and zero tax while preserving `principal = monthlyDeposit * months`.
- `annualRate === 0` returns zero interest and zero tax before the monthly compound division.

## Required Cases

- T1 raw simple pretax interest in Node v26.3.1: `100000 * (0.03 / 12) * 12 * 13 / 2 = 19500`. Rounded pretax interest: `19500`.
- T2 raw simple pretax interest in Node v26.3.1: `100000 * (0.12 / 12) * 1 * 2 / 2 = 1000`. Rounded pretax interest: `1000`.
- Pinned tax derivation examples:
  - T1: `principal=1200000`, `pretaxInterest=19500`, `tax=3003`, `afterTaxInterest=16497`, `maturityAmount=1216497`
  - T2: `principal=100000`, `pretaxInterest=1000`, `tax=154`, `afterTaxInterest=846`, `maturityAmount=100846`
- Pinned monthly compound example: `P=100000, n=36, r=0.05, M` returns `principal=3600000`, `pretaxInterest=291481`, `tax=44888`, `afterTaxInterest=246593`, `maturityAmount=3846593`.
- T3 monotonic combinations:
  - `P=100000, n=36, r=0.05`: `S=277500`, `M=291481`
  - `P=10000, n=12, r=0.0003`: `S=19`, `M=20`
  - `P=500000, n=24, r=0.03`: `S=375000`, `M=382287`
  - `P=1000000, n=12, r=0.12`: `S=780000`, `M=809328`
- T4 zero-rate cases:
  - `S`: `principal=1200000`, `pretaxInterest=0`, `tax=0`, `afterTaxInterest=0`, `maturityAmount=1200000`
  - `M`: `principal=1200000`, `pretaxInterest=0`, `tax=0`, `afterTaxInterest=0`, `maturityAmount=1200000`

## Invariants

- The test matrix covers `r` values `0.01`, `0.03`, `0.045`, `0.12`; `n` values `6`, `12`, `24`, `36`; `P` values `10000`, `500000`, `1000000`; and both `S` and `M`.
- Every matrix result verifies:
  - `tax = floor(pretaxInterest * 0.154)`
  - `afterTaxInterest = pretaxInterest - tax`
  - `principal = P * n`
  - `maturityAmount = principal + afterTaxInterest`
  - all five result fields are integers
- `lib/interest.ts` contains one `Math.round` call, applied only to raw pretax interest.
- Regression tests now include fixed expected values for T1/T2 tax derivation and one monthly compound branch case, so they do not only recalculate the implementation's invariant expressions.

## Verification Results

- `npm test` passed: 23 tests, 23 pass. The runner picked up `lib/interest.test.ts` and the existing `lib/my-rate.test.ts`.
- `npm run typecheck` passed.
- `npm run build` first failed inside the sandbox before application build because `tsx` could not listen on its temp IPC pipe. Re-running the same command outside the sandbox passed; the log showed `check:reviewed` before `next build` and `검수 완료 확인: 전 43건 reviewed: true`.
- Scope check after review fixes: only `lib/interest.test.ts` and this record changed from the reviewed implementation. `package.json`, `tsconfig.json`, `lib/types.ts`, `data/products.json`, `app/**`, and `scripts/**` are unchanged.

## Notes For Issue #5

- Convert `myRateBp` to this module's decimal annual rate with `myRateBp / 10000`.
- Keep that conversion at the caller boundary. This module intentionally uses the spec's floating-point `i = r / 12` and absorbs common edge values with the final pretax-interest rounding.
