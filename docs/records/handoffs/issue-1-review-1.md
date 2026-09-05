CLAUDE.md와 `docs/agents/development.md`, `docs/agents/orchestration.md`, 커밋 컨벤션을 먼저 확인한 뒤, diff를 저장소 실물과 대조하며 리뷰했다. 리뷰 중 직접 재실행한 검증은 Summary에 정리했다.

## Findings

**반드시 수정**

1. `lib/use-products.ts:30-34` — 클라이언트 훅에 설계에 존재하지 않던 `forceError` 주입 분기가 들어갔다. 핸드오프의 설계 결정은 강제 실패 스위치를 **라우트 한 곳**(`app/api/products/route.ts`)에만 두는 것이었고, 실패 상태 검증 수단도 DevTools Offline으로 명시되어 있었다(실제로 Codex도 CDP Offline으로 검증했으므로 이 분기는 검증에 쓰이지도 않았다). 결과적으로 프로덕션 훅이 테스트 전용 분기와 `window.location.search` 파싱을 안고 있고, `requestId === 0` 조건 때문에 "첫 요청만 실패한다"는 문서화되지 않은 규칙이 하나 더 생겼다. 프로덕션 클라이언트 청크에서 이 분기가 제거되는 것은 확인했으므로 동작상 위험은 확인되지 않았지만, 설계 이탈이고 제거 비용이 5줄이다. → 훅에서 이 분기를 삭제하고, 실패 상태는 라우트의 `?forceError=1` 또는 Offline으로만 재현한다.

2. 핸드오프가 명시적으로 요구한 "설계 결정 중 다르게 간 항목과 이유" 보고가 3건 누락됐다. 리포트에는 `agentRules: false`와 `jsx: react-jsx`만 적혀 있고, (a) 위 1번의 클라이언트 forceError 분기, (b) `formatDisclosureMonth`를 `lib/products.ts`가 아닌 신규 `lib/format.ts`로 분리한 것, (c) `next.config.ts`의 `outputFileTracingRoot: process.cwd()` 추가가 빠졌다. (b)는 무해하지만 (c)는 배포 동작에 영향을 주는 설정인데 커밋 메시지 본문에도 근거가 남지 않았다(`docs/conventions/commit-message.md`의 "변경 이유가 코드만으로 분명하지 않으면 본문에 배경과 판단 근거를 적는다"에 걸린다). → 남은 이탈 항목과 근거를 PR 본문 또는 `docs/records/`에 남긴다.

**선택 개선**

3. `app/api/products/route.ts` — 캐시 헤더가 지정되지 않았다. Next 15+ Route Handler는 기본 동적이라 매 요청마다 함수가 실행되고 72KB JSON을 재직렬화한다. 빌드마다 불변인 데이터이므로 `Cache-Control: public, s-maxage=..., stale-while-revalidate=...` 정도가 적합하다. 이슈 범위 밖이라면 후속 이슈로 넘겨도 된다.

4. `app/_components/product-list.tsx` — `<h1>적금 상품 목록</h1>`이 success 분기 안에만 있어서 loading/error 상태에서는 문서에 제목이 사라진다. `데이터 기준:` 줄은 데이터 의존이라 그대로 두고 `<h1>`만 상태 밖(`app/page.tsx` 또는 컴포넌트 상단)으로 올리는 것을 권한다.

5. `package.json` — `"next": "^16.3.4"`가 caret이라 CI 없이 마이너가 자동으로 올라간다. 이 이슈가 #2~#13의 기반이 되는 점을 고려하면 고정(또는 최소 마이너 고정)을 권한다.

## Questions

1. Next 16 메이저 채택을 승인하는가? 핸드오프의 스택 결정에는 버전이 명시되지 않았지만, 기반 이슈에서 프레임워크 메이저를 올리는 것은 "다르게 가려면 먼저 알릴 것"에 해당한다. 근거로 든 `npm audit`의 PostCSS advisory는 식별자·영향 범위가 리포트에도 저장소에도 남아 있지 않아 "Next 15 패치 대신 메이저 상향이 최소 대응이었는가"를 검증할 수 없다. 승인한다면 결정 근거를 `docs/records/`에 남기고, 아니면 15 라인으로 되돌리는 편이 낫다.
2. `next.config.ts`의 `agentRules: false`는 Next 16이 `AGENTS.md`(Codex 진입점)를 자동 편집하는 것을 막는 설정이다(Next 16 config schema에 실재하는 옵션임을 확인했다). 이 정책을 유지하는가?
3. `outputFileTracingRoot: process.cwd()`는 `.worktrees/issue-1`에서 빌드하며 생긴 lockfile 루트 추론 문제를 우회하려는 것으로 보인다. Vercel 배포에서도 필요한 설정인가? 불필요하면 제거를 권한다.
4. 응답이 `reviewed`, `unexplainedBp`, `conditions[].evidence` 같은 내부 검수 필드까지 그대로 공개한다. §6 데이터 모델대로이긴 하나, 공개 API 표면으로 내보내는 것이 의도된 결정인가?

## Test Gaps

1. 자동 테스트가 0건이고 CI 워크플로도 없어서(`.github/workflows` 부재) 모든 AC가 수동 1회 확인에 의존한다. 이슈 범위 밖인 것은 맞지만, 이슈 #4에서 러너 도입 시 최소한 다음을 덮어야 한다: `/api/products` 계약(최상위 키 2개·43건), `rawSpecialCondition` 전건 동일성, `formatDisclosureMonth` 단위 테스트, 훅 상태 배타성.
2. AC 2를 `products[0]` 한 건만 diff로 확인했다. 전건 비교가 한 줄이면 된다: `diff <(curl -s localhost:3000/api/products | jq -S '.products|map({finPrdtCd,rawSpecialCondition})') <(jq -S '.products|map({finPrdtCd,rawSpecialCondition})' data/products.json)`.
3. `scripts/lib/types.ts` 셰임의 **런타임** 경로가 검증되지 않았다. `check:reviewed`·`build-products`·`mark-reviewed`는 전부 `import type`이라 esbuild가 지워버려서 셰임을 로드조차 하지 않는다 — 즉 `npm run build` 통과는 셰임의 런타임 해석을 증명하지 못한다. 값 재export(`CONDITION_CODES`)를 실제로 쓰는 건 `scripts/extract-conditions.ts` 하나뿐이고 이 스크립트는 실행되지 않았다. 이번 리뷰에서 내가 `tsx`로 `scripts/lib/types.js`를 직접 로드해 `CONDITION_CODES` 9건이 나오는 것까지 확인했으므로 현재는 정상이지만, 빌드 게이트가 이 경로를 지켜주지 않는다는 사실은 남는다.
4. 프로덕션 `next start` 검증이 `?forceError=1` 200 응답 1건에 그쳤다. 프로덕션 빌드 산출물 기준 확인은 이번 리뷰에서 보강했다(아래 Summary).

## Summary

Acceptance Criteria 10개 항목은 전부 충족한다. 아래는 이번 리뷰에서 내가 직접 재검증한 결과다.

- `npm run typecheck` → exit 0 (`strict: true` 유지, `scripts/`·`agents/`까지 include에 포함됨).
- `npm run check:reviewed` → exit 0, `검수 완료 확인: 전 43건 reviewed: true`. `build`는 `check:reviewed && next build` 체인이라 게이트 순서가 보존된다. `next build` 자체는 기존 `.next` 산출물을 덮어쓰지 않기 위해 재실행하지 않았다(리뷰어는 저장소를 변경하지 않는다는 전제).
- `data/products.json`: 최상위 키가 정확히 `disclosureMonth`/`products`, 43건, 전건 `reviewed: true`, 전건 `disclosureMonth === "202608"`. `finPrdtCd`·`${companyName}-${finPrdtCd}`·옵션 키 조합 모두 중복 0건이라 현재 데이터에서 React key 충돌은 발생하지 않는다.
- AC 10: 프로덕션 클라이언트 정적 청크에 `forceError` 문자열이 남아 있지 않다(NODE_ENV 인라이닝으로 분기 제거). 같은 청크에 `data/products.json` 본문도, `FSS_API_KEY`/`sk-ant-` 류 문자열도 포함되지 않는다 — 제약 5(키 클라이언트 유출 금지) 충족.
- Tailwind 파이프라인 동작 확인: 프로덕션 CSS(6.1KB)에 `min-h-screen`/`divide-y`/`text-slate-950`/`border-slate-200`이 모두 포함된다.
- `agentRules`는 Next 16 config schema에 실제로 존재하는 옵션이다(`node_modules/next/dist/server/config-schema.js:496`).
- `next-env.d.ts`가 gitignore된 `.next/types/*.d.ts`를 import하지만, `skipLibCheck: true`가 선언 파일의 진단을 통째로 건너뛰므로(`typescript.js`의 `skipTypeCheckingWorker`) 클린 체크아웃에서 `typecheck`가 깨지지 않는다 — 위험 요소로 보였으나 실제 문제가 아님을 확인했다.
- 커밋 여부는 오케스트레이터가 구현 프롬프트에서 요구하고 `hasCommits`로 강제하므로(`agents/orchestrator/lib/prompts.ts:47`, `index.ts:63`), `docs/agents/development.md`의 "커밋 요청이 없으면 커밋하지 않는다" 위반이 아니다.

반드시 수정 2건은 모두 설계 이탈과 보고 누락이며 기능 결함이 아니다. 1번(훅의 forceError 분기 삭제)만 코드 변경이 필요하고, 2번은 문서/PR 본문 보완이면 된다.