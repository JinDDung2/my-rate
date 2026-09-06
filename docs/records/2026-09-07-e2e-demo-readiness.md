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
| Secondary demo: salary transfer selected | `<production-origin>/?m=500000&t=12&r=S&c=SALARY_TRANSFER` | My leader still `10-01-30-031-0036` at 3.6%; advertised leader `TD11330030000` at 4.1%; badge remains visible |

The query strings were generated through `lib/share-url.ts` serialization.

## Definition Of Done

| # | Requirement | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Deployment URL changes ranking in real time when conditions change | Blocked for production; locally supported | `calculator.tsx` recomputes `buildRanking` in `useMemo` when amount, term, reserve type, or selected conditions change. `npm test` includes `changes ranking when the selected condition set changes`. Production manual toggle check remains pending until Vercel auth exists. |
| 2 | Advertised #1 differs from my-condition #1 in demo input | Pass | `npm test` real-data case passed. Input `500,000`, `12`, `S`, no conditions returns my leader `10-01-30-031-0036` and advertised leader `TD11330030000`. |
| 3 | Calculation engine tests T1-T7 all pass | Pass | `npm test` passed 81/81. Output included T1, T2, T3, T4, T5, T6, and T7 pass lines. |
| 4 | All products reviewed by a human | Pass | `npm run build` ran `check:reviewed` and printed `검수 완료 확인: 전 43건 reviewed: true`. Review basis: `docs/records/2026-09-03-condition-extraction.md`, `docs/knowledge/extraction-verification.md`. |
| 5 | Every condition card has original disclosure evidence | Pass with scope note | One-time evidence check printed `unreviewed 0 evidence-miss 0`. There are 105 condition records and all have evidence contained in `rawSpecialCondition` after whitespace normalization. `OTHER`/`rateBp:0` records are not rendered as selectable satisfied/unsatisfied condition cards; they are represented by the disabled `기타(계산 제외)` row and, where applicable, the F-09 unexplained-rate notice. This satisfies F-08 for AI-interpreted condition cards. |
| 6 | Not-financial-advice disclaimer appears on every screen | Pass | `SiteDisclaimer` is rendered from `app/layout.tsx`. Local production HTML contained information-only purpose, FSS data source/month, monthly approximation, and equal monthly deposit assumption for free-reserve products. |
| 7 | Plan/spec match deployed screen | Mostly pass; production URL pending | Local production HTML and code match the checklist below. Production visual/manual confirmation remains pending until deployment succeeds. |

## Verification Log

```bash
npm test
# tests 81, pass 81, fail 0
# T1 calculates simple pretax interest...
# T2 rounds simple pretax interest once...
# T3 keeps monthly compound...
# T4 returns zero interest and zero tax...
# T5 clamps...
# T6 keeps base rate...
# T7 does not add unexplainedBp...
# T7 allows applied conditions...

npm run typecheck
# tsc --noEmit passed

npm run build
# check:reviewed passed with 전 43건 reviewed: true
# next build compiled successfully

npx tsx -e "<evidence verification>"
# unreviewed 0 evidence-miss 0

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
| F-08 | Condition evidence span and full raw text toggle | Applied/unapplied condition rows render `condition.evidence`; `<details>` renders `rawSpecialCondition`. | Match |
| F-08 | `AI 해석` badge on AI-interpreted entries | `ConditionList` renders `AI 해석` for applied/unapplied condition rows. | Match |
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
