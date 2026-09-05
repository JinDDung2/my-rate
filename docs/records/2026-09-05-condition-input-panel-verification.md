# Condition Input Panel Verification

Issue #2 adds the top calculator input panel. This note records the review follow-up fixes, required browser checks, and handoff reporting items.

## Fixes

- Product names in `ProductList` were changed from `h2` to `h3` so the page keeps `h1` > section `h2` > product `h3` heading order.
- `parseMonthlyAmount` now trims leading and trailing whitespace before validating digits, so pasted values like `" 500000"` and `"500000 "` are accepted.
- The monthly amount warning and "계산 적용 금액" helper are shown together during invalid input, with `aria-describedby` pointing to both nodes.
- `CONDITION_META.OTHER.checkboxLabel` was removed. `OTHER` is informational only and is not rendered as a checkbox.
- Amount step buttons now restore the committed value and clear the warning when the visible text is invalid at a min/max boundary.

## Decisions

- Comma formatting is applied outside the input: the text input preserves the user's draft string, while the helper and committed summary render `formatKrw(...)`. This avoids cursor jumps on every keystroke.
- No design decision from the original handoff was intentionally changed. The only optional item not implemented is matching product count in the temporary output.
- `OTHER` is rendered as an informational row with a `선택 불가` badge, not as a disabled checkbox. It has no `input` element and cannot enter `selectedConditions`.
- The temporary output includes only the committed input summary. It does not include matching product count, interest, or rate values, keeping #3/#4/#5 scope untouched.

## Verification

- `npm run typecheck` passed.
- `npm run build` passed. The log showed `npm run check:reviewed` before `next build`, with `검수 완료 확인: 전 43건 reviewed: true`.
- `npm run dev -- --port 3001` started successfully after sandbox escalation. Chrome CDP at 390px confirmed:
  - no submit button exists;
  - term `12` -> `36`, reserve type `정액적립` -> `자유적립`, and condition toggle all update the committed summary immediately;
  - invalid values `9000`, `1000001`, `15000`, `abc`, and empty text show inline warnings while the summary keeps the previous valid amount;
  - `300000` clears the warning and updates the summary to `300,000원`;
  - `OTHER` row has no `input` element, and clicking the row does not change selected condition count;
  - 390px layout has no horizontal scroll, condition controls are one column, and checked touch targets are at least 44px high;
  - Tab order reaches monthly amount, step buttons, the selected term radio, the selected reserve radio, and all 8 condition checkboxes. Native radio groups expose the selected radio by Tab; other radio choices are reachable with arrow keys.
- CDP network tracking during those input interactions recorded `interactionRequests: []`. In `next dev`, the initial product load can appear twice because of development remount behavior; no requests were emitted by input changes.
- `npm run start -- --port 3003` against the production build was checked with the same CDP script. It recorded `initialApiCount: 1` for `/api/products` and `interactionRequests: []` after changing inputs.
- Step boundary behavior was verified in the production build: `10,000` plus decrement stays `10,000`, `1,000,000` plus increment stays `1,000,000`, and pressing a step button after invalid text restores the committed boundary value and clears the warning.
- 390px evidence screenshot: [2026-09-05-issue-2-390px.png](assets/2026-09-05-issue-2-390px.png).

## Pure Function Checks

`./node_modules/.bin/tsx -e ...` was run after the parser fix:

| Input | Result |
| --- | --- |
| `500000` | valid `500000` |
| `9000`, `1000001` | `out-of-range` |
| `15000` | `not-a-step` |
| `abc`, `-20000`, `500000abc`, `10000.5`, `1e5` | `not-a-number` |
| `''`, `'   '` | `empty` |
| `500,000`, `' 500000'`, `'500000 '` | valid `500000` |
| `10000000000000000` | `out-of-range` |

`toggleCondition(toggleCondition([], 'APP_MISSION'), 'SALARY_TRANSFER')` returned `['SALARY_TRANSFER', 'APP_MISSION']`, preserving `CONDITION_CODES` order. Toggling `SALARY_TRANSFER` twice returned `[]`. `clampMonthlyAmount(0)` returned `10000`, and `clampMonthlyAmount(2000000)` returned `1000000`.
