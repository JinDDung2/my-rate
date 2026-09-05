# Product Data Load Decisions

Issue #1 added the initial Next.js product list UI and `/api/products` route. The handoff asked that any deviations from the design decisions be recorded; this note captures the reviewed decisions that were not fully documented in the original implementation report.

## Decisions

- Client-side `forceError` handling was removed from `lib/use-products.ts`. Failure simulation stays in one place: the development-only `/api/products?forceError=1` route branch. UI failure and retry behavior were verified in Chrome via DevTools Protocol request failure for `/api/products`, so production client code does not need a test-only query parser or first-request-only failure rule.
- `formatDisclosureMonth` lives in `lib/format.ts` instead of `lib/products.ts`. The formatter is UI-oriented and does not participate in narrowing the statically imported product JSON to `ProductsResponse`, so separating it keeps `lib/products.ts` focused on the API response source.
- `next.config.ts` does not set `outputFileTracingRoot`; the earlier worktree-local override was removed so production tracing is not tied to the agent checkout layout.
- `next.config.ts` keeps `agentRules: false` so Next.js does not manage or rewrite the Codex-facing `AGENTS.md` entrypoint. This preserves the repository's existing agent orchestration documents as the source of truth.

## Verification

- `npm run typecheck` passed after installing dependencies from `package-lock.json`.
- `npm run build` passed after sandbox escalation for `tsx` IPC pipe creation. The log showed `check:reviewed` first with `검수 완료 확인: 전 43건 reviewed: true`, then `next build`.
- With `npm run dev` on `http://localhost:3001`, `curl -s http://127.0.0.1:3001/api/products | jq '{disclosureMonth, n: (.products|length)}'` returned `{ "disclosureMonth": "202608", "n": 43 }`.
- `diff <(curl -s http://127.0.0.1:3001/api/products | jq -r '.products[0].rawSpecialCondition') <(jq -r '.products[0].rawSpecialCondition' data/products.json)` produced no output.
- `curl -s -o /dev/null -w '%{http_code}' 'http://127.0.0.1:3001/api/products?forceError=1'` returned `500` in development mode.
- Chrome headless was driven through DevTools Protocol on `http://localhost:3001`: normal load showed `데이터 기준: 2026-08` and `총 43개 상품`; forced failure of browser requests to `/api/products` showed `데이터를 불러오지 못했습니다` and `재시도` while the loading text was absent; clearing the failure and clicking `재시도` issued another `/api/products` request and restored the product list.
- Full-page DevTools Offline plus reload was attempted separately. It showed Chrome's document-load error page (`ERR_INTERNET_DISCONNECTED`) instead of the app shell, so it is not a valid way to verify this app's in-page retry UI unless the document and client chunks are already reliably cached.
- `next dev` temporarily changed `next-env.d.ts` from `.next/types/*` imports to `.next/dev/types/*`; the final `npm run build` restored the committed `.next/types/*` references, so no `next-env.d.ts` change remains.
