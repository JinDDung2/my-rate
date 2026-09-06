## Findings

없음.

diff는 원래 핸드오프의 Acceptance Criteria를 모두 충족한다.

- `findAdvertisedLeader` / `buildTopProductSummary`는 React/Next import 없는 순수 함수이고 `lib/ranking.ts`에 추가됨. `buildRanking` 본문·시그니처·`RankingRow` 필드 불변.
- 광고 1위 정렬: `option.maxRate` desc → `option.baseRate` desc → `compareCodePointAscending(finPrdtCd)`. `finPrdtCd`가 행마다 유일하므로 완전 전순서 → 입력 순서 무관 결정적. 후보 집합은 `buildRanking` 결과(`rows`)를 그대로 입력받음.
- `differsFromAdvertised = rankingRows[0].finPrdtCd !== advertisedLeader.finPrdtCd`. 같으면 `false`.
- 카드는 `rankingRows[0]` 기준: 광고 최고금리 `myLeader.maxRate.toFixed(2)%`, 내 금리 `myLeader.myRate.toFixed(2)%`, 원금 `formatKrw(interest.principal)+원`, 세후이자 `formatKrw(interest.afterTaxInterest)+원`. 재계산 없음.
- 충족 O = `myRateResult.applied`, 미충족 X = `myRateResult.unapplied`, `<h3>`로 구분. 빈 배열은 "없음". `excluded`는 렌더 안 함(`applied`/`unapplied`가 이미 `isCountable` 통과분만 담음).
- 우대폭은 `formatRateBpPercentPoint`로 `%p` 표기(`50→0.5%p`, `25→0.25%p`, `100→1%p`, `10→0.1%p`), 불필요한 0 제거.
- 배지: amber 스타일 + "광고 1위와 다릅니다" 텍스트(색상 단독 아님), `differsFromAdvertised`일 때만 렌더.
- 렌더 조건: `calculator.tsx`에서 `rankingRows && rankingRows.length > 0` + 컴포넌트 내 `summary` null 가드(이중). `<RankingTable>` 아래, `<ProductList>` 위 배선.
- `aria-labelledby="top-product-heading"`로 `<h2>`와 연결(`ranking-table.tsx` 컨벤션 동일).
- F-09 미해석 우대폭·근거 원문 보기는 `{/* F-09 ... #8에서 배선한다. */}` 주석으로 명시, 렌더 안 함.
- 금지 파일(`lib/interest.ts`, `lib/my-rate.ts`, `lib/types.ts`, `data/products.json`, `package.json`, `tsconfig.json`, `scripts/**`, `app/api/**` 등) 변경 없음. `git diff --stat` 범위는 helper/테스트/format/카드/calculator 배선/기록 문서로 한정됨.
- `lib/format.ts`는 기존 시그니처 유지하고 `formatRateBpPercentPoint`만 추가.

## Questions

- 광고 1위를 `buildRanking` 후보 집합(기간·적립방식 필터 통과분)으로 한정한 것은 핸드오프의 명시적 가정이고 AC도 그렇게 규정하므로 구현은 부합한다. 다만 `REALRATE_기능명세서.md:122-123`의 F-06 문구만 보면 "최고우대금리 기준 1위"가 사용자 선택 필터와 무관한 전체 상품 중 최고 광고금리 상품일 여지도 있다. 이 해석 차이를 스펙 오너에게 확인했는가?
- 배지가 뜰 때(광고 1위 ≠ 내 조건 1위) 카드에 광고 1위 상품이 무엇인지(상품명·금리)를 보여주지 않는다. `summary.advertisedLeader`는 이미 계산돼 있는데 표시하지 않는 것이 의도된 UX인가? (AC 위반은 아님)

## Test Gaps

- **광고 1위 후보 집합 한정 불변식 미검증**: 높은 `maxRate`를 가지지만 기간/적립방식 불일치로 `buildRanking`에서 탈락한 상품이 광고 1위로 뽑히지 **않는다**는 테스트가 없다. 실데이터 케이스 (e)는 "다르다"만 확인할 뿐 이 불변식은 커버하지 않는다.
- **실데이터 동일 케이스 미검증**: 핸드오프 Verification이 요구한 "두 1위가 같아지는 입력 1건"은 기록 문서에만 있고, 테스트로는 합성 fixture(`SHARED_LEADER`)만 커버한다. 실데이터로 `differsFromAdvertised === false` 되는 입력을 assert하는 테스트가 없다.
- **`rankingRows === null` 경로 미검증**: 컴포넌트/배선 테스트가 빈 배열만 커버하고 `null`(calculator 가드) 경로는 없다. 경미함(호출부 가드).
- **`formatRateBpPercentPoint(0)` 미검증**: `excluded`가 formatter에 도달하지 않으므로 실질 영향은 없으나 경계값 테스트는 빠져 있다.
- **375px 레이아웃 / 수동 시각 확인 미수행**: 브라우저 자동화 부재로 미실행, 기록 문서에 사유 명시됨(핸드오프 허용 범위).
- 리뷰어 환경 제약으로 `npm test` / `npm run typecheck` / `npm run build`를 직접 재실행하지 못했다. 코드·테스트 정적 검토상 일관되며 Codex가 42 pass / typecheck 통과 / 샌드박스 밖 build 통과를 보고함. `lib/top-product-card.test.ts`만 `@/` 별칭을 쓰는데 tsx v4의 tsconfig `paths` 해석에 의존한다(다른 테스트는 상대경로) — 실행 환경에서 재확인 권장.

## Summary

핸드오프 Acceptance Criteria 기준으로 구현·테스트·기록 문서 모두 부합하며 차단 이슈 없음. 순수 헬퍼 2종(`findAdvertisedLeader`, `buildTopProductSummary`)은 결정적이고 `buildRanking` 계약을 건드리지 않는다. 카드는 `rankingRows[0]` 데이터를 재계산 없이 표시하고, 배지/`%p` 포맷/`없음` 폴백/`excluded` 제외/`aria-labelledby`/F-09 후속 주석까지 규정대로다. 남은 것은 스펙 해석 확인 1건(광고 1위 후보 범위)과 테스트 보강(후보 집합 한정 불변식, 실데이터 동일 케이스) 정도로, 모두 비차단이다.