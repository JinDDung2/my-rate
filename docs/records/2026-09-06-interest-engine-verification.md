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
- T3 monotonic combinations:
  - `P=100000, n=36, r=0.05`: `S=277500`, `M=291481`
  - `P=10000, n=6, r=0.000001`: `S=0`, `M=0`
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
  - reapplying `Math.round` to `pretaxInterest` is stable
- `lib/interest.ts` contains one `Math.round` call, applied only to raw pretax interest.

## Verification Results

- `npm test` passed: 22 tests, 22 pass. The runner picked up `lib/interest.test.ts` and the existing `lib/my-rate.test.ts`.
- `npm run typecheck` passed.
- `npm run build` passed outside the sandbox. Inside the sandbox it failed before application build because `tsx` could not listen on its temp IPC pipe; outside the sandbox the log showed `check:reviewed` before `next build` and `검수 완료 확인: 전 43건 reviewed: true`.
- Scope check passed: `lib/interest.ts`, `lib/interest.test.ts`, this record, and `docs/records/handoffs/issue-4-plan.md` are the only tracked changes. `package.json`, `tsconfig.json`, `lib/types.ts`, `data/products.json`, `app/**`, and `scripts/**` are unchanged.

## Notes For Issue #5

- Convert `myRateBp` to this module's decimal annual rate with `myRateBp / 10000`.
- Keep that conversion at the caller boundary. This module intentionally uses the spec's floating-point `i = r / 12` and absorbs common edge values with the final pretax-interest rounding.
