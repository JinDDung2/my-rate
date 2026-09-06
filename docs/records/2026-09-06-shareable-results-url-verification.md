# Shareable Results URL Verification

Issue #11 adds deterministic share URLs for the committed `CalcInput` state.

## Implementation

- Added `lib/share-url.ts` as a React/Next-independent pure module.
- Query format:
  - `m`: monthly amount integer
  - `t`: term months
  - `r`: reserve type, `S` or `F`
  - `c`: comma-separated selected condition codes, omitted when empty
- Serialization always emits keys in `m,t,r,c` order.
- `c` is normalized to `CHECKABLE_CONDITION_CODES` order, so condition click order does not affect the URL.
- Parsing never throws and returns a valid `CalcInput`.
- Monthly amount parsing uses `parseInt`, defaults invalid numbers to `500000`, clamps to `10000..1000000`, rounds to the nearest `10000`, then clamps again.
- `termMonths` and `reserveType` use whitelist matching. Invalid values fall back field-by-field to `DEFAULT_CALC_INPUT`.
- Conditions are case-sensitive, deduplicated, filtered to `CHECKABLE_CONDITION_CODES`, and sorted by the standard order. `OTHER` is ignored.
- Added `snapMonthlyAmount` to `lib/calc-input.ts` for URL parsing reuse.
- Added `hydrate(next)` to `useCalcInput`; it resets `input`, `amountText`, and `amountError` together.
- `Calculator` restores from `window.location.search` in a mount `useEffect` only when at least one of `m/t/r/c` is present.
- `useSearchParams` was not used, avoiding Suspense/dynamic route behavior and SSR hydration mismatch risk.
- URL generation is on-demand from the share button only. Input changes do not call `history.replaceState`.
- Added `ShareButton` under the input panel. It uses `navigator.clipboard.writeText` when available, shows a copied status on success, and exposes a read-only URL input when the Clipboard API is missing or rejects.

## Verification Results

- `npm test` passed: 81 tests, 81 pass. The runner included `lib/share-url.test.ts`.
- `npm run typecheck` passed.
- `npm run build` first failed in the sandbox because `tsx` could not listen on its temp IPC pipe. After installing local dependencies in the worktree with `npm install`, re-running `npm run build` outside the sandbox passed.
- The build log showed `check:reviewed` before `next build`, with `검수 완료 확인: 전 43건 reviewed: true`.
- `npm run dev -- --port 3001` served `http://localhost:3001` outside the sandbox.
- `curl -I http://localhost:3001/` returned `200 OK`.
- `GET http://localhost:3001/api/products` returned `200 OK`, disclosure month `202608`, and 43 products.

## Browser Smoke

Headless Chrome/CDP was used against `http://localhost:3001`.

- Set monthly amount `300000`, term `24`, reserve type `F`, then clicked `CARD_USAGE` before `SALARY_TRANSFER`.
- Share fallback path generated:

```text
http://localhost:3001/?m=300000&t=24&r=F&c=SALARY_TRANSFER,CARD_USAGE
```

- The generated query kept standard condition order despite reverse click order.
- Opening that URL in a new tab restored:
  - amount input text: `300000`
  - term: `24`
  - reserve type: `F`
  - selected conditions: `SALARY_TRANSFER`, `CARD_USAGE`
- Original and restored tabs matched exactly for:
  - committed input summary
  - ranking table rows 1 to 3
  - top product card
  - action list
- The restored top product card preserved the demo case where advertised #1 differs from the user's #1:
  - user #1: `NH1934월복리적금`
  - badge shown: `광고 1위와 다릅니다`
- No Runtime or Log errors were captured in the Chrome sessions.
- Clipboard success feedback was verified with browser clipboard permissions granted: `공유 링크를 복사했어요.` was shown.
- Clipboard fallback was verified by removing `navigator.clipboard`: a read-only URL input was shown with the generated link.
- URL auto-update was checked after changing inputs without pressing the share button: `location.href` stayed `http://localhost:3001/`.

## Invalid Query Smoke

- `?m=abc&t=99&r=Z&c=BOGUS,OTHER` restored defaults and rendered normally.
- `?m=15000&t=12&r=S` restored amount `20000`, term `12`, reserve `S`.
- `?m=99999999` restored amount `1000000`.
- `?utm_source=demo` did not trigger hydration and kept `DEFAULT_CALC_INPUT`.

## Notes

- The only network observed during the interactive smoke was the existing products fetch. In dev mode, React/Next issued `/api/products` twice for the initial load path; share clicks and input changes did not introduce a new endpoint.
- No runtime dependencies were added. `package.json` dependencies are unchanged.
