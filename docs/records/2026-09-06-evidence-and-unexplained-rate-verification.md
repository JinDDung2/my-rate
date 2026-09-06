# Evidence and Unexplained Rate Verification

Issue #8 implements F-08, F-09, and the related §8.2 output-verification display contract for the `[C] 1위 상품 상세 카드`.

## Implementation

- Added `rawSpecialCondition` and `unexplainedBp` to `RankingRow`.
- `buildRanking` copies both fields from the source `Product` without recalculating them.
- `TopProductCard` renders every displayed applied/unapplied preferential condition with:
  - the condition label and formatted rate
  - an `AI 해석` text badge
  - the original `evidence` span content from the extraction result
- `TopProductCard` renders the full product `rawSpecialCondition` in a native `<details><summary>` disclosure labeled `근거 원문 보기 ▾`.
- The raw text uses `whitespace-pre-wrap` so line breaks from `spcl_cnd` are preserved.
- `TopProductCard` renders the F-09 notice only when `unexplainedBp > 5`.
- `calculateMyRate`, `calculateInterest`, and the ranking interest calculation do not add `unexplainedBp`.

## Decisions

- The top-card prop remains `rankingRows` only. Carrying the build-time product fields on `RankingRow` keeps the server-render test path simple and avoids an additional product lookup in the component.
- The component remains a pure render component. It does not use `'use client'`, `useState`, or client-side JavaScript for the raw-text toggle.
- `evidence` and `unexplainedBp` are trusted as build-time validated fields and are displayed as-is at runtime.
- `excluded` conditions remain omitted from the applied/unapplied condition lists. Their source text remains available through the full raw-condition disclosure.
- The F-09 threshold is strict: `5bp` exactly is not displayed; `>5bp` is displayed.

## Demo Cases

- Default visible top-card case: `monthlyAmount=500000`, `termMonths=12`, `reserveType=S`, `selectedConditions=[]`
  - Top product: `10-01-30-031-0036`, `JB 다이렉트적금(정액적립식)`.
  - The applied list is empty. The unapplied list contains `당행 계좌 자동이체 6회 이상 입금` with `AI 해석` and evidence text.
  - The full raw condition appears in the `근거 원문 보기 ▾` disclosure.
  - `unexplainedBp=0`, so the F-09 notice is not shown.
- F-09 notice test case: synthetic `RankingRow` with `unexplainedBp=60`.
  - The card renders `미해석 우대폭 0.6%p (미반영)`.
  - The card renders `공시상 최대 0.6%p의 추가 우대가 있으나 조건을 특정할 수 없어 반영하지 않았습니다`.
- F-09 threshold test case: synthetic `RankingRow` with `unexplainedBp=5`.
  - The card does not render the unexplained-rate notice.
- Real-data search:
  - `data/products.json` has nonzero `unexplainedBp` values `[5, 50, 60, 90, 220, 250, 400, 600]`.
  - `unexplainedBp > 5` products are present, but exhaustive checks across 6/12/24/36 month terms, fixed/free reserve type, monthly amounts `100000/500000/1000000`, and all 256 checkable-condition subsets found no current real-data input where one of those products is the after-tax top-ranked product.

## Verification Results

- `npm test` passed: 54 tests, 54 pass.
  - Coverage includes condition evidence rendering, `AI 해석` badge rendering, native `<details>` raw-condition disclosure, F-09 `>5bp` display, `=5bp` non-display, excluded-condition omission, and `unexplainedBp` non-addition to `myRate`.
- `npm run typecheck` passed.
- `npm run build` first failed in the sandbox because `tsx` could not listen on its temp IPC pipe. Re-running outside the sandbox initially exposed that this worktree lacked local `node_modules/next`.
- `npm install --prefer-offline` installed local dependencies from the lockfile without changing tracked files.
- `npm run build` then passed outside the sandbox:
  - `check:reviewed`: `전 43건 reviewed: true`
  - Next production build compiled successfully and generated static pages.
- `npm run dev -- --port 3001` served `http://localhost:3001`; `curl -I /` returned `200 OK`.
- `/api/products` returned `200 OK` with disclosure month `202608` and the 43-product payload.
- Browser automation was not available: `npm ls playwright @playwright/test --depth=0` returned empty. Therefore the 375px visual layout and contrast check was not automated in this worktree.
