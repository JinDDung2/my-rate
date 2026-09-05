## Findings

**1. `tsconfig.json:33-42` — `include`가 `**/*.ts`로 넓어져 레포 루트의 `.worktrees/*` 사본까지 프로그램에 들어온다. (반드시 수정)**

`exclude`가 `["node_modules"]`뿐이다. TypeScript의 `**`는 `node_modules`류 폴더만 암묵적으로 건너뛰므로(`typescript.js:22309` `implicitExcludePathRegexPattern`), `.worktrees/`는 걸러지지 않는다. 이 브랜치가 main에 들어가면 메인 체크아웃에서:

- `.worktrees/issue-1/{app,lib,scripts,agents}/**/*.ts(x)` 가 전부 타입체크 대상이 된다 (현재 이 머신에 실제로 존재한다).
- 즉 **다른 이슈를 작업 중인 Codex 워크트리에 컴파일 에러가 하나라도 있으면 메인의 `npm run typecheck`와 `npm run build`가 깨진다.** AC 8이 요구하는 빌드 게이트가 무관한 작업물에 의존하게 된다.

`.worktrees/`는 이 저장소의 오케스트레이터가 스스로 만드는 디렉터리다(`.gitignore` 마지막 항목, `docs/records/2026-09-05-agent-orchestrator-worktree-isolation.md`). `exclude`에 `.worktrees`를 추가해야 한다.

**2. AC 4·5·6이 검증되지 않았고, 검증 수단도 함께 사라졌다.**

`addd94a`가 `lib/use-products.ts`에서 클라이언트 `forceError` 분기를 제거하면서, 앱 UI로 실패 상태를 유도할 경로가 남지 않았다. 대체 검증은 "DevTools Offline"인데 **Codex 리포트에는 브라우저 검증 기록이 전혀 없다.** 핸드오프 Verification 4번(정상 로드 / 실패 문구 / 재시도 클릭)이 통째로 비어 있고, `docs/records/2026-09-05-product-data-load-decisions.md:8`은 "should be verified"라는 미래형으로 적혀 있다 — 즉 안 했다는 뜻이다. CLAUDE.md의 "못 한 검증은 이유를 남긴다"도 충족되지 않았다(생략 사실 자체가 리포트에 없다).

코드를 읽은 한 `useProducts`의 상태 전이(`loading|success|error` 배타, `requestId` 증가 → `cache: 'no-store'` 재요청)는 논리적으로 맞다. 그러나 **AC 4·5·6은 "구현이 맞아 보인다"이지 "검증됐다"가 아니다.**

**3. 핸드오프 Verification 3번의 `?forceError=1` → `500` 확인이 누락됐다.**

리포트에 있는 것은 프로덕션에서 `200`(= AC 10, 도달 불가)뿐이다. 개발 모드에서 500이 실제로 나오는지는 확인되지 않았다. `app/api/products/route.ts:7`의 조건 자체는 단순해 위험은 낮지만, 이제 이 분기가 실패 상태를 만드는 **유일한** 수단이므로 검증 없이 두면 안 된다.

**4. `next.config.ts:5` — 워크트리 사정으로 넣은 설정이 영구 설정으로 커밋됐다.**

`outputFileTracingRoot: process.cwd()`는 `.worktrees/issue-1`에서 빌드했기 때문에 넣은 값이다(기록 문서에 명시). Vercel에서는 cwd가 프로젝트 루트라 사실상 무해하지만, 로컬 임시 사정을 배포 설정에 새긴 것이고 빌드 프로세스의 cwd가 달라지면 조용히 트레이싱 루트가 바뀐다. 이슈 #1의 산출물로 남길 값이 아니다.

**5. 요청 없는 커밋 2건.**

`docs/agents/development.md`의 Git 규칙은 "커밋 요청이 없으면 커밋하지 않는다"이고, 핸드오프도 이 문서를 읽으라고 명시했다. `68839e2`, `addd94a`가 커밋됐다. 별도 지시가 있었다면 무시해도 된다(→ Questions).

**확인했고 문제없는 항목**: AC 1(`data/products.json` = `disclosureMonth "202608"` / 43건 실측), AC 2(정적 import + 무가공 서빙), AC 7·8(`build` = `check:reviewed && next build`, 게이트 유지), AC 9(`lib/types.ts` 단일 정의, `scripts/lib/types.ts` 셰임의 런타임 값 re-export가 실제로 동작함을 `tsx`로 확인 — `CONDITION_CODES` 로드됨), AC 10, React key 충돌 없음(43건 `companyName-finPrdtCd` 유일, 옵션 복합키 중복 0건), `jsx: "react-jsx"`(Next 16이 수용, 빌드 후 트리 clean), `agentRules`(Next 16.3.4 실존 옵션).

## Questions

1. `68839e2`/`addd94a` 커밋은 사용자가 요청한 것인가? 아니라면 development.md Git 규칙 위반이다.
2. `outputFileTracingRoot`를 남길 이유가 있나? 배포는 레포 루트에서 도는데, 지금 제거하지 않으면 되돌릴 계기가 없다.
3. `lib/products.ts:4`의 `as ProductsResponse`는 무검증 캐스트다. 데이터 파이프라인이 스키마를 바꿔도 API는 조용히 잘못된 형태를 서빙한다. 런타임 검증은 이슈 #4(테스트 러너 도입) 시점으로 미루는 게 합의된 방향인가?
4. `lib/format.ts:2` — 6자리가 아니면 원문을 그대로 반환한다. 조용한 폴백이 의도인가, 아니면 데이터 이상을 드러내야 하나?

## Test Gaps

- **AC 4·5·6 전부**: 에러 문구·재시도 클릭·상태 배타성에 대한 자동 테스트도 수동 기록도 없다. 최소한 브라우저 Offline → 문구/버튼 확인 → Offline 해제 → 클릭 → 목록 렌더까지 한 번 돌리고 기록을 남겨야 한다.
- **개발 모드 `?forceError=1` → 500**: 미확인(위 Findings 3).
- **셰임의 값 re-export 경로**: `npm run build`는 `check-reviewed.ts`만 실행하고 거기서 `Product`는 `import type`이라 컴파일 시 지워진다. 즉 빌드 통과가 셰임의 런타임 동작을 증명하지 않는다. 값 import는 `scripts/extract-conditions.ts:16`(`CONDITION_CODES`)뿐이고 이 스크립트는 API 키가 필요해 실행되지 않았다. (이번 리뷰에서 `npx tsx`로 직접 import해 동작을 확인했으므로 현재는 문제없음.)
- **`npm run typecheck`의 커버리지가 `.next` 존재 여부에 좌우된다**: `.next/types/validator.ts`(라우트 핸들러 시그니처 검증)가 include에 있어, 클린 체크아웃에서 빌드 전 typecheck를 돌리면 이 검증이 빠진 채로 통과한다. CI를 붙일 때 `build` → `typecheck` 순서를 정해둬야 한다.
- 테스트 러너 미도입은 핸드오프 합의대로 범위 밖. 이슈 #4에서 도입 시 첫 대상은 `formatDisclosureMonth`와 `/api/products` 응답 스키마(위 Questions 3)를 권한다.

## Summary

AC 1·2·7·8·9·10은 코드와 데이터를 직접 대조해 충족을 확인했다. AC 3·4·5·6은 구현 로직상 타당하나 **실제로 검증된 적이 없다** — 특히 클라이언트 `forceError` 제거로 실패 상태를 유도할 인앱 경로가 사라졌는데도 대체 검증(브라우저 Offline)이 실행되지 않았고, 리포트는 그 생략을 밝히지 않았다. 병합 전 반드시 고칠 것은 두 가지다: `tsconfig.json`의 `exclude`에 `.worktrees` 추가(안 하면 메인 체크아웃의 빌드 게이트가 무관한 에이전트 워크트리에 오염된다), 그리고 AC 4·5·6의 수동 검증 실행 및 기록. `outputFileTracingRoot`는 제거를 권한다. 나머지는 핸드오프의 설계 결정과 제약을 충실히 따랐다.