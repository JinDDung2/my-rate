# E2E Demo Readiness

Issue #13 verifies the RealRate MVP against the contest submission requirements and records the remaining release risks.

## Deployment

| Item | Result |
| --- | --- |
| Target platform | Vercel, per `REALRATE_기획서.md` §7 |
| Deployment config | `vercel.json` added: Next.js framework, `npm ci`, `npm run build` |
| Production URL | Blocked in this environment: Vercel CLI returned `No existing credentials found` on `npx vercel deploy --prod --yes` |
| Availability window | Requirement is `2026-09-07 11:00` through `2026-09-11 23:59`; production deployment still needs authenticated Vercel access before `2026-09-07 11:00` |
| Environment variables | `ANTHROPIC_API_KEY` must be set only in Vercel project environment variables if F-10 runtime AI is enabled; no API key value is recorded here |

Attempted command:

```bash
npx vercel deploy --prod --yes
# Error: No existing credentials found. Run `vercel deploy --temporary` to create a temporary deployment you can claim later, or `vercel login` to log in.
```

Temporary Vercel deployment was not used as the submission URL because it is not an acceptable basis for the required uninterrupted availability window.

## Demo URLs

Replace `<production-origin>` after the authenticated Vercel deployment is created.

| Scenario | URL | Expected |
| --- | --- | --- |
| Primary demo: no preferential conditions | `<production-origin>/?m=500000&t=12&r=S` | My leader `10-01-30-031-0036` at 3.6%; advertised leader `TD11330030000` at 4.1%; badge `광고 1위와 다릅니다` |
| Secondary demo: salary transfer selected | `<production-origin>/?m=500000&t=12&r=S&c=SALARY_TRANSFER` | Verified with `buildRanking`: my leader `10-01-30-031-0036` at 3.6%, after-tax interest `98,982`; advertised leader `TD11330030000` at max 4.1% but my rate 2.2%; badge `광고 1위와 다릅니다` remains visible |

The query strings were generated through `lib/share-url.ts` serialization. The secondary demo is fixed by `lib/ranking.test.ts` case `keeps the real-data demo difference when salary transfer is selected`.

## Definition Of Done

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Deployment URL changes ranking in real time when conditions change | Blocked for production; locally supported | `calculator.tsx` recomputes `buildRanking` in `useMemo` when amount, term, reserve type, or selected conditions change. `npm test` includes `changes ranking when the selected condition set changes`. Production manual toggle check remains pending until Vercel auth exists. |
| 2 | Advertised #1 differs from my-condition #1 in demo input | Pass | `npm test` real-data cases passed. Input `500,000`, `12`, `S`, no conditions returns my leader `10-01-30-031-0036` and advertised leader `TD11330030000`. Input `500,000`, `12`, `S`, `SALARY_TRANSFER` returns the same differing leaders, so the badge remains visible. |
| 3 | Calculation engine tests T1-T7 all pass | Pass | `npm test` passed 82/82. The actual output below includes T1, T2, T3, T4, T5, T6, and T7 pass lines. |
| 4 | All products reviewed by a human | Pass | `npm run build` ran `check:reviewed` and printed `검수 완료 확인: 전 43건 reviewed: true`. Review basis: `docs/records/2026-09-03-condition-extraction.md`, `docs/knowledge/extraction-verification.md`. |
| 5 | Every condition card has original disclosure evidence | Pass with scope note | One-time evidence check printed `unreviewed 0 evidence-miss 0`. There are 105 condition records and all have evidence contained in `rawSpecialCondition` after whitespace normalization. F-08 applies to rendered condition cards; `OTHER`/`rateBp:0` records are excluded from selectable satisfied/unsatisfied cards, so they are outside that card-level scope. The disabled `기타(계산 제외)` row is only a static input placeholder, not per-product evidence rendering. Per-product OTHER-derived wording remains inspectable through the `근거 원문 보기` toggle, which exposes the full `rawSpecialCondition`. |
| 6 | Not-financial-advice disclaimer appears on every screen | Pass | `SiteDisclaimer` is rendered from `app/layout.tsx`. Local production HTML contained information-only purpose, FSS data source/month, monthly approximation, and equal monthly deposit assumption for free-reserve products. |
| 7 | Plan/spec match deployed screen | Mostly pass; production URL pending | Local production HTML and code match the checklist below. Production visual/manual confirmation remains pending until deployment succeeds. |

## Verification Log

```bash
npm test

> my-rate@0.1.0 test
> node --import tsx --test lib/**/*.test.ts

▶ ActionListCard
  ✔ renders sorted action rows with plus-prefixed, thousands-formatted won amounts (21.8885ms)
  ✔ renders at most 3 action rows even when more candidates exist (0.987667ms)
  ✔ renders nothing for empty rankings, missing products, and fully satisfied conditions (0.353292ms)
✔ ActionListCard (24.087583ms)
▶ buildActionList
  ✔ returns the top 3 unique unmet conditions sorted by after-tax interest delta (5.257333ms)
  ✔ returns an empty list when the baseline is already clamped at maxRate (0.247792ms)
  ✔ keeps partially clamped additions when the effective delta is positive (0.109292ms)
  ✔ deduplicates duplicate unmet rows by code and sums their rateBp (0.091583ms)
  ✔ measures each addition on top of already selected conditions (0.219125ms)
  ✔ uses CONDITION_CODES order as the tie-breaker for equal deltas (0.109375ms)
  ✔ keeps baseline interest aligned with buildRanking row interest (0.285041ms)
✔ buildActionList (10.583416ms)
▶ formatRateBpPercentPoint
  ✔ formats basis points as percent-point values without unnecessary trailing zeroes (1.022916ms)
✔ formatRateBpPercentPoint (2.282375ms)
▶ interest calculation
  ✔ T1 calculates simple pretax interest for 12 monthly deposits at 3% (3.565167ms)
  ✔ T2 rounds simple pretax interest once for one month at 12% (0.151791ms)
  ✔ pins a monthly compound pretax interest example from the spec formula (0.076583ms)
  ✔ T3 keeps monthly compound pretax interest greater than or equal to simple interest (0.200792ms)
  ✔ T4 returns zero interest and zero tax when annualRate is zero (0.081208ms)
  ✔ derives tax, after-tax interest, principal, and maturity amount from rounded pretax interest (0.076208ms)
  ✔ keeps rounded pretax interest stable across common floating point edges (1.627ms)
  ✔ uses Math.round only once in the interest module (0.188667ms)
  ✔ guards non-positive deposit or month inputs with zero interest (0.144ms)
✔ interest calculation (9.510625ms)
▶ my-rate calculation
  ✔ T6 keeps base rate when no conditions are selected for every real option (9.279584ms)
  ✔ T5 clamps the real KB product at maxRate when all checkable conditions are selected (0.451375ms)
  ✔ T5 clamps synthetic rates by basis points (0.152708ms)
  ✔ keeps myRate at baseRate when malformed data has maxRate below baseRate (0.07725ms)
  ✔ excludes OTHER and unsupported checked conditions from the sum (0.111208ms)
  ✔ sums duplicate condition rows for the same checked code (0.101625ms)
  ✔ puts zero-rate conditions in excluded even when checked (2.738542ms)
  ✔ partitions and sorts all condition rows deterministically (1.069917ms)
  ✔ preserves condition objects for later detail screens (0.466292ms)
  ✔ T7 does not add unexplainedBp for real products that have it (0.869458ms)
  ✔ T7 allows applied conditions while still leaving maxRate unreached (0.208333ms)
  ✔ keeps basis-point arithmetic exact at common floating point edges (0.865042ms)
  ✔ returns null when no matching rate option exists (0.068916ms)
  ✔ matches reserve type when the same term has fixed and flexible options (0.062958ms)
  ✔ holds full-data invariants for representative condition subsets (9.852458ms)
✔ my-rate calculation (30.718917ms)
▶ situation text validation
  ✔ rejects non-string, empty, blank, and over-limit text (1.355ms)
  ✔ trims valid text (0.078458ms)
✔ situation text validation (2.240167ms)
▶ situation output normalization
  ✔ filters unknown codes, removes duplicates, and sorts by standard order (0.162792ms)
  ✔ clamps summary and falls back when summary is blank or non-string (0.099334ms)
  ✔ rejects missing condition arrays (0.059583ms)
✔ situation output normalization (0.447667ms)
▶ parse situation orchestration
  ✔ returns normalized output from an injected llm caller (0.168167ms)
  ✔ returns invalid_output when parsed output is null (0.094833ms)
  ✔ returns upstream_error when the llm caller throws (0.197958ms)
  ✔ returns timeout when the llm caller aborts (0.138917ms)
  ✔ returns timeout when the sdk reports a connection timeout (0.125958ms)
  ✔ keeps native abort errors classified as timeout (0.09475ms)
✔ parse situation orchestration (0.997542ms)
▶ calc input condition union
  ✔ preserves existing selections, ignores OTHER, deduplicates, and keeps standard order (0.081542ms)
✔ calc input condition union (0.138833ms)
▶ ranking calculation
  ✔ excludes products without a matching term and reserve type option (3.869458ms)
  ✔ returns an empty ranking when no product has a matching option (0.325292ms)
  ✔ filters and ranks free-reserve options when reserveType is F (0.313708ms)
  ✔ sorts real products by after-tax interest descending (0.85075ms)
  ✔ uses base rate as the tie-breaker when after-tax interest is identical (0.292166ms)
  ✔ uses finPrdtCd as the deterministic tie-breaker when interest and base rate are identical (0.27625ms)
  ✔ changes ranking when the selected condition set changes (0.279583ms)
  ✔ derives each row interest from myRateBp / 10000 and the matched option interest type (0.331291ms)
  ✔ keeps real row values aligned with the lower-level calculators (0.476917ms)
  ✔ carries unexplainedBp without adding it to myRate (1.442333ms)
✔ ranking calculation (10.36725ms)
▶ top product summary
  ✔ finds the advertised leader deterministically regardless of input order (0.188458ms)
  ✔ reports no difference when the after-tax leader is also the advertised leader (0.095833ms)
  ✔ reports a difference when the advertised max-rate leader is not the after-tax leader (0.086458ms)
  ✔ returns null for an empty ranking (0.058208ms)
  ✔ finds a real-data case where the advertised leader differs from the after-tax leader (0.113042ms)
  ✔ keeps the real-data demo difference when salary transfer is selected (0.0945ms)
✔ top product summary (0.772542ms)
▶ FixedWindowRateLimiter
  ✔ allows 10 requests in a window and blocks the 11th (1.579292ms)
  ✔ isolates windows by key (0.601667ms)
  ✔ reports retry-after based on remaining window time (0.568042ms)
✔ FixedWindowRateLimiter (3.759875ms)
▶ getClientIp
  ✔ uses x-forwarded-for first value, then x-real-ip, then unknown (27.409667ms)
✔ getClientIp (27.517584ms)
▶ calc input share URL serialization
  ✔ serializes with deterministic key and condition order (0.919ms)
  ✔ omits c when no conditions are selected (0.075833ms)
  ✔ round-trips through the parser (1.079208ms)
  ✔ builds a fresh absolute URL and drops existing search or hash (0.09375ms)
✔ calc input share URL serialization (3.144375ms)
▶ calc input share URL parsing
  ✔ returns defaults for an empty query or blank values (0.165542ms)
  ✔ defaults invalid monthly amounts (0.060833ms)
  ✔ snaps and clamps monthly amounts (0.088958ms)
  ✔ defaults unsupported term and reserve values (0.080125ms)
  ✔ filters unknown conditions, OTHER, lowercase, blanks, and duplicates (0.132ms)
  ✔ falls back field-by-field and preserves other valid fields (0.127375ms)
  ✔ detects whether a query has calc input keys (0.087834ms)
✔ calc input share URL parsing (0.9585ms)
▶ TopProductCard
  ✔ renders the after-tax leader values, condition lists, and advertised-leader badge (18.448958ms)
  ✔ renders no badge when the advertised leader matches and uses the empty-list fallback (0.709875ms)
  ✔ renders the unexplained preferential-rate notice only above 5bp (1.618417ms)
  ✔ renders nothing for an empty ranking (0.157166ms)
✔ TopProductCard (21.783375ms)
ℹ tests 82
ℹ suites 16
ℹ pass 82
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 549.947542

npm run typecheck

> my-rate@0.1.0 typecheck
> tsc --noEmit

npm run build

> my-rate@0.1.0 build
> npm run check:reviewed && next build


> my-rate@0.1.0 check:reviewed
> tsx scripts/check-reviewed.ts

검수 완료 확인: 전 43건 reviewed: true
▲ Next.js 16.3.4 (Turbopack)
✓ Running next.config.ts took 102ms

  Creating an optimized production build ...
✓ Compiled successfully in 999ms
  Running TypeScript ...
  Finished TypeScript in 1105ms ...
  Collecting page data using 6 workers ...
  Generating static pages using 6 workers (0/4) ...
  Generating static pages using 6 workers (1/4)
  Generating static pages using 6 workers (2/4)
  Generating static pages using 6 workers (3/4)
✓ Generating static pages using 6 workers (4/4) in 334ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ƒ /api/parse-situation
└ ƒ /api/products


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

npx tsx -e "const d=require('./data/products.json'); const bad=d.products.filter(p=>!p.reviewed); const ev=d.products.flatMap(p=>p.conditions.filter(c=>!c.evidence|| !p.rawSpecialCondition.replace(/\s+/g,'').includes(c.evidence.replace(/\s+/g,'')))); console.log('unreviewed', bad.length, 'evidence-miss', ev.length);"
unreviewed 0 evidence-miss 0

npm start -- -p 3001
curl http://localhost:3001/
# 200
curl http://localhost:3001/api/products
# 200; disclosureMonth 202608; products 43
curl -i -H 'Content-Type: application/json' -d '{"text":"월급은 이 은행으로 받고 마케팅 수신 동의는 가능해요"}' http://localhost:3001/api/parse-situation
# 503 {"error":"anthropic_api_key_missing"}
```

Server stdout/stderr did not print the submitted F-10 text during the local production smoke. App route code also contains no app-level request text logging path.

## Spec To Screen Checklist

| Source | Requirement | Screen/code result | Classification |
| --- | --- | --- | --- |
| Plan §4, Spec §4 | Single page with input panel, ranking table, top product card, action list | `[A]` input, `[B]` ranking, `[C]` top card, `[D]` action list components exist. Top card/action list render after product load and non-empty ranking. | Match |
| Spec §4 | Ranking columns: rank, bank, product, advertised rate, my rate, after-tax receipt | `ranking-table.tsx` renders `순위`, `은행`, `상품명`, `광고금리`, `내금리`, `세후실수령`. | Match |
| F-02 | Monthly amount 10,000-1,000,000, 10,000 step | `lib/calc-input.ts` enforces min/max/step; invalid input shows inline warning and preserves last valid calculation. | Match |
| F-02 | Terms 6/12/24/36 and reserve type | `TERM_OPTIONS = [6, 12, 24, 36]`; radio controls render fixed/free reserve types. | Match |
| F-02 | 8 condition checkboxes, no submit button for recalculation | `CHECKABLE_CONDITION_CODES` excludes `OTHER`, rendering 8 checkboxes. Recalculation is driven by state changes. | Match |
| F-06 | Badge when advertised leader differs from my leader | `top-product-card.tsx` renders `광고 1위와 다릅니다` when `differsFromAdvertised` is true. | Match |
| F-08 | Condition evidence span and full raw text toggle | Applied/unapplied condition rows render `condition.evidence`; `<details>` renders `rawSpecialCondition`. `excluded` conditions are not rendered as condition cards, so F-08 card evidence does not apply to them; their source wording is still available in the full raw disclosure toggle. | Match with scope note |
| F-08 | `AI 해석` badge on AI-interpreted entries | `ConditionList` renders `AI 해석` for every applied/unapplied condition row. This is acceptable because all committed condition rows are AI-extraction outputs reviewed in `docs/records/2026-09-03-condition-extraction.md`; the badge therefore marks the extraction method, not low confidence. | Match |
| F-09 | Show unexplained preferential rate when `G - sum(rateBp) > 0.05%p` | Code uses `myLeader.unexplainedBp > 5` basis points, equal to greater than 0.05%p. | Match |
| F-10 | Runtime natural-language input degrades quietly on failure/timeout | Local production with no `ANTHROPIC_API_KEY` returned 503; client code catches non-OK responses and shows one manual fallback toast. | Match, production smoke pending |
| F-11 | Shareable query-string URL | `serializeCalcInput` produced deterministic `m`, `t`, `r`, `c` query strings used above. | Match |
| F-12 | Footer disclaimer: not advice, source/month, monthly approximation | Footer includes those plus free-reserve equal-monthly-deposit assumption. | Match |
| Spec §10 | Availability `2026-09-07 11:00` to `2026-09-11 23:59` | Authenticated Vercel production deploy is not yet available from this environment. | Screen/platform action required |
| Plan header vs Spec §10 | Plan deadline says `2026-09-07 10:00`; spec availability starts `2026-09-07 11:00` | Treat as document inconsistency: deploy must be live before the earlier contest submission deadline and remain up through the spec availability window. | Document inconsistency |
| Plan §4 demo numbers | Illustrative examples mention 7.00%, 2.80%, 76,986 won | Current real FSS 202608 data yields different product/rate numbers, but demonstrates the same "leader changes" behavior. | Allowed illustrative difference |

## Remaining Risks

- Production deployment is blocked until Vercel credentials or a project-linked CI deployment is available. This is the only open blocker for the submission URL and deployed manual checks.
- If `ANTHROPIC_API_KEY` is not configured in production, F-10 remains available only through manual fallback. This is acceptable by spec, but the production smoke should record the toast once the URL exists.
- Vercel free-tier cold starts may affect `/api/parse-situation` when runtime AI is enabled. Core ranking is static/client-side and has no database or runtime LLM dependency.
- Platform access logs may include URL query strings by default. F-11 intentionally stores reproducible input state in the query string; no app-level logging of request bodies was found.
