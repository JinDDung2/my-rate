# Non-Functional Verification

Issue #12 adds the site-wide disclaimer and accessibility-focused UI hardening for the RealRate MVP.

## Implementation

- Added `SiteDisclaimer` as a server component rendered from `app/layout.tsx` after every route's children.
- The disclaimer includes:
  - not financial advice / information-only purpose
  - data source: 금융감독원 금융상품통합비교공시
  - disclosure month from `productsResponse.disclosureMonth`, formatted with `formatDisclosureMonth`
  - monthly approximate interest calculation notice
  - free-reserve products are calculated as equal monthly deposits for the MVP
- Changed the root body to `flex min-h-[100dvh] flex-col` and the home `main` to `flex-1`, so the footer sits after content without a fixed overlay.
- Raised low-contrast helper text from `text-slate-500` to `text-slate-600`.
- Added visible `focus-visible` rings to buttons, radio inputs, checkboxes, `summary`, and the horizontal table scroll region.
- Made the ranking table horizontal scroll container keyboard-focusable with `role="region"` and `tabIndex={0}`.
- Kept amount formatting on the existing `formatKrw` path. No new currency formatter was added.

## Verification Results

- `npm run typecheck` passed.
- `npm test` passed: 81 tests, 81 pass.
- `npm run build` first failed in the sandbox because `tsx` could not listen on its temp IPC pipe. Running the same command outside the sandbox passed. The log showed `check:reviewed` before `next build`, with `검수 완료 확인: 전 43건 reviewed: true`.
- `npm start -- -p 3001` served the production build. Port 3000 was already in use, so 3001 was used for verification.
- `GET /` returned `200 OK` and contained the disclaimer text. The rendered HTML included `금융자문이 아니며`, `금융감독원 금융상품통합비교공시`, `기준월: 2026-08`, `월 단위 근사 계산`, and the free-reserve equal-monthly-deposit assumption.
- `GET /api/products` returned `disclosureMonth = 202608` and 43 products.
- Temporary derivation check: changing `data/products.json` `disclosureMonth` from `202608` to `209912` made `SiteDisclaimer` render `기준월: 2099-12`; the data file was immediately restored and has no final diff.
- `POST /api/parse-situation` with a test text returned `503 {"error":"anthropic_api_key_missing"}` in this environment. Server stdout/stderr did not print the submitted text.
- `rg "console\.|logger|log\(" app lib -n` returned no matches.
- `rg "text-slate-(400|500)|disabled:bg-slate-400" app lib -n` returned no matches.
- `rg "formatKrw|toLocaleString|Intl.NumberFormat" app lib -n` confirmed all app-level amount displays use `formatKrw`; only `lib/format.ts` defines `Intl.NumberFormat`.
- `git diff --name-only` has no `lib/interest.ts`, `lib/ranking.ts`, `lib/format.ts`, `data/**`, or `scripts/**` changes.

## Accessibility

- Lighthouse was run against `http://localhost:3001/` with the accessibility category only.
- Result: accessibility score `1.0`.
- `color-contrast` audit: pass.
- Other checked audits: `button-name`, `label`, and `tabindex` all passed.
- Lighthouse JSON artifact: `docs/records/assets/2026-09-06-issue-12-lighthouse-accessibility.json`.
- Contrast token calculation for the main edited foreground/background pairs:
  - `slate600` on white: 7.58:1
  - `slate600` on `slate50`: 7.24:1
  - `slate700` on white: 10.35:1
  - `white` on `slate950`: 20.17:1
  - `red700` on white: 6.47:1
  - `emerald700` on white: 5.48:1
  - `amber900` on `amber50`: 8.75:1
  - `sky900` on `sky50`: 8.87:1

## Performance

Measured the condition-change calculation path by running `buildRanking(productsResponse.products, input)` 10 times across representative condition states.

```json
{
  "times": [0.381, 0.059, 0.037, 0.024, 0.03, 0.033, 0.039, 0.023, 0.033, 0.025],
  "median": 0.033,
  "max": 0.381
}
```

The measured main-thread calculation path is well below the 200ms budget. No production performance instrumentation was added.

## Responsive Screenshots

- 360px mobile: `docs/records/assets/2026-09-06-issue-12-mobile-360.png`
- 390px mobile: `docs/records/assets/2026-09-06-issue-12-mobile-390.png`
- 1280px desktop: `docs/records/assets/2026-09-06-issue-12-desktop-1280.png`

The footer is not a fixed overlay. It is rendered after the main content, so it does not cover inputs, result rows, action lists, or the share button on narrow screens.

## Notes

- Platform access logs are outside the app-level "do not log user input" control boundary. Share URLs can intentionally contain query-string input state for reproducible judging.
- No calculation, ranking, formatter, data, or fetch pipeline files were changed.
