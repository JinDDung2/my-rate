# Top Product Detail Verification

Issue #6 adds the `[C] 1위 상품 상세 카드` below the ranking table.

## Implementation

- Added `findAdvertisedLeader(rows)` and `buildTopProductSummary(rows)` to `lib/ranking.ts`.
- `findAdvertisedLeader` uses the same filtered `RankingRow[]` candidate set as `buildRanking`.
- The advertised leader order is:
  - `option.maxRate` descending
  - `option.baseRate` descending
  - `finPrdtCd` ascending by direct code-point comparison
- `buildTopProductSummary` compares `rankingRows[0]` and the advertised leader by `finPrdtCd`.
- Added `formatRateBpPercentPoint(rateBp)` in `lib/format.ts`.
- Added `app/_components/top-product-card.tsx` and rendered it below `<RankingTable>` when `rankingRows.length > 0`.
- The card displays the after-tax leader's advertised max rate, my rate, principal, after-tax interest, applied conditions, and unapplied conditions.
- `excluded` conditions are not rendered as preferential-rate conditions.

## Decisions

- The advertised leader is calculated only from rows that passed the current term and reserve-type filter. Products outside that candidate set cannot be compared on the user's selected calculation input.
- Product equality uses `finPrdtCd` because `findRateOption` produces one matched option per product row for the current input.
- `%p` formatting divides basis points by 100 and trims trailing zeroes through numeric conversion: `50 -> 0.5%p`, `25 -> 0.25%p`, `100 -> 1%p`.
- F-09 unexplained preferential-rate notice and evidence/original-text disclosure are intentionally not rendered here. They remain scoped to #8.

## Demo Cases

- Different leaders: `monthlyAmount=500000`, `termMonths=12`, `reserveType=S`, `selectedConditions=[]`
  - After-tax leader: `10-01-30-031-0036`, JB 다이렉트적금(정액적립식), max `3.70%`, my `3.60%`, principal `6,000,000`, after-tax interest `98,982`.
  - Advertised leader: `TD11330030000`, 여행스케치_남도투어적금, max `4.10%`, base `2.20%`.
  - `differsFromAdvertised=true`, so the card shows `광고 1위와 다릅니다`.
- Same leader: `monthlyAmount=500000`, `termMonths=12`, `reserveType=S`, all checkable conditions selected.
  - After-tax leader and advertised leader: `TD11330030000`, 여행스케치_남도투어적금.
  - max `4.10%`, my `4.10%`, principal `6,000,000`, after-tax interest `112,730`.
  - `differsFromAdvertised=false`, so the badge is not rendered.

## Verification Results

- `npm test` passed: 42 tests, 42 pass. New coverage includes advertised-leader deterministic ordering, equal leaders, different leaders, empty rows, and the real-data differing-leader case.
- Review follow-up added direct coverage for `formatRateBpPercentPoint` (`100 -> 1%p`, `50 -> 0.5%p`, `25 -> 0.25%p`, `10 -> 0.1%p`) and server-render coverage for the top-product card badge, empty-list fallback, condition lists, and `excluded` omission.
- `npm run typecheck` passed.
- `npm run build` first failed in the sandbox because `tsx` could not listen on its temp IPC pipe. Re-running the same command outside the sandbox passed with `검수 완료 확인: 전 43건 reviewed: true`, successful Turbopack compile, TypeScript, and static page generation.
- Earlier implementation verification also confirmed `npm run build -- --webpack` and the default Turbopack build after local locked dependencies were installed.
- `npm run dev -- --port 3001` served `http://localhost:3001`; `curl -I /` returned `200 OK`.
- `/api/products` returned `200 OK` with disclosure month `202608` and the product payload. The body was large in terminal output, but the response contained the expected 43-product dataset.
- Browser automation was not available: `npm ls playwright @playwright/test --depth=0` returned empty. Therefore the 375px visual layout check was not automated in this worktree.
- `next-env.d.ts` was changed by Next dev/build and restored to the committed production type references.
- `git diff --stat` scope was limited to the ranking helper/test, format helper, top-product card, calculator wiring, and this record.
