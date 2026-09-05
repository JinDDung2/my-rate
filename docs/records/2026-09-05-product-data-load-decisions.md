# Product Data Load Decisions

Issue #1 added the initial Next.js product list UI and `/api/products` route. The handoff asked that any deviations from the design decisions be recorded; this note captures the reviewed decisions that were not fully documented in the original implementation report.

## Decisions

- Client-side `forceError` handling was removed from `lib/use-products.ts`. Failure simulation stays in one place: the development-only `/api/products?forceError=1` route branch. UI failure and retry behavior should be verified with browser network offline mode, so production client code does not need a test-only query parser or first-request-only failure rule.
- `formatDisclosureMonth` lives in `lib/format.ts` instead of `lib/products.ts`. The formatter is UI-oriented and does not participate in narrowing the statically imported product JSON to `ProductsResponse`, so separating it keeps `lib/products.ts` focused on the API response source.
- `next.config.ts` sets `outputFileTracingRoot: process.cwd()` because this issue was implemented and built inside `.worktrees/issue-1`. The explicit root avoids Next.js tracing the parent repository when lockfile root inference sees the outer workspace. It should be revisited if production builds run from a different checkout layout.
- `next.config.ts` keeps `agentRules: false` so Next.js does not manage or rewrite the Codex-facing `AGENTS.md` entrypoint. This preserves the repository's existing agent orchestration documents as the source of truth.
