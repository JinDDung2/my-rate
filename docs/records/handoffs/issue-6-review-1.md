CLAUDE.md와 관련 파일(`lib/ranking.ts`, `lib/format.ts`, `lib/ranking.test.ts`, `app/_components/top-product-card.tsx`, `calculator.tsx`, `lib/my-rate.ts`, `lib/conditions.ts`, `lib/types.ts`, `tsconfig.json`, `data/products.json` 해당 구간)을 읽고 원 핸드오프의 Acceptance Criteria와 대조했다.

실행 검증(`npm test` / `npm run typecheck` / `npm run build`)은 이 세션의 샌드박스가 `node`/`npm`/`tsc` 실행을 모두 차단해 직접 재현하지 못했다. 아래는 코드·데이터 정적 분석 결과다.

## Findings

없음.

- 순수성: `findAdvertisedLeader` / `buildTopProductSummary`는 React/Next import 없음, `'use client'` 없음. `lib/ranking.ts`의 기존 import 범위 내. ✅
- 광고 1위 정렬: `option.maxRate` desc → `option.baseRate` desc → `finPrdtCd` 코드포인트 asc. `buildRanking`의 `compareCodePointAscending` 재사용. `[...rows].sort()`로 입력 비변경. `finPrdtCd`가 행마다 유일(상품당 옵션 1개)하므로 전순서 → 배열 순서 무관 결정적. ✅
- 비교 키: `myLeader.finPrdtCd !== advertisedLeader.finPrdtCd`. ✅
- 카드 데이터: `maxRate.toFixed(2)%`, `myRate.toFixed(2)%`, `formatKrw(interest.principal)+원`, `formatKrw(interest.afterTaxInterest)+원` — 전부 `rankingRows[0]`에서 직접 표시, 재계산 없음. ✅
- 충족/미충족: `myRateResult.applied` / `unapplied`만 렌더. 이 두 리스트는 `calculateMyRate`에서 `isCountable` 통과분만 담기므로 `excluded`(OTHER·rateBp 0)는 구조적으로 배제됨. "충족 O" / "미충족 X" 헤딩으로 분리. 비면 "없음". ✅
- `%p` 포맷: `Number((rateBp/100).toFixed(2))` → 정수 basis point 기준 `50→0.5%p`, `25→0.25%p`, `100→1%p`, `10→0.1%p` 모두 정확(부동소수 오차 없음). ✅
- 배지: `differsFromAdvertised`일 때만 렌더, "광고 1위와 다릅니다" 텍스트 포함, amber 색상 + 텍스트 동시 전달. ✅
- 렌더 조건: `calculator.tsx`에서 `rankingRows && rankingRows.length > 0` 가드 + `buildTopProductSummary`가 빈 배열에 `null`. null·빈 배열이면 카드/배지 모두 미렌더. (핸드오프 본문의 "RankingTable과 동일 조건" 서술은 자체 모순이나 — RankingTable은 빈 배열에도 안내문을 렌더함 — 구현은 명시적 AC "빈 배열이면 카드 미렌더"를 따름.) ✅
- `aria-labelledby="top-product-heading"` ↔ `<h2 id="top-product-heading">`. ✅
- 미해석 우대폭/근거 원문: 미렌더 + 후속 이슈(#8) 주석 존재. ✅
- 금지 파일 및 `buildRanking` 본문: 변경 없음. `git diff --stat`상 6개 파일(ranking.ts / ranking.test.ts / format.ts / top-product-card.tsx / calculator.tsx / 기록 문서)로 한정. `next-env.d.ts` 변경 없음. ✅
- `tsconfig.json`에 `noUncheckedIndexedAccess` 없음 → `.sort()[0]` 및 `rows[0] ?? null`이 `RankingRow`로 좁혀져 반환 타입 `RankingRow | null`과 정합. 타입 오류 소지 없음. ✅
- 실데이터 정합성 확인: `data/products.json`에서 `10-01-30-031-0036`(12/S: base 3.6 / max 3.7), `TD11330030000`(12/S: base 2.2 / max 4.1) 값이 테스트 단언과 일치. `TD11330030000`이 12/S 중 유일 최대 `maxRate 4.1`이면 "같은 1위" 데모(전 조건 선택 시 myRate 4.1로 클램프)도 논리적으로 성립.

## Questions

- `top-product-card.tsx`의 후속 이슈 주석이 근거 원문 보기를 `F-08`로 표기했다. 스펙/핸드오프는 이를 `F-09`(및 이슈 `#8`) 소관으로 부른다. 의도한 라벨인가, 오타인가? (동작 영향 없음, 문서 일관성만.)
- "충족 O"/"미충족 X" 두 섹션이 헤딩 텍스트 외에는 칩 스타일이 완전히 동일하다. AC 예시가 곧 텍스트 라벨이라 기준은 충족하나, 의도적으로 색/아이콘 구분을 생략한 것인지 확인 바란다.

## Test Gaps

- `formatRateBpPercentPoint`에 대한 직접 단위 테스트가 없다. `50 → 0.5%p` 매핑은 컴포넌트가 테스트되지 않으므로 자동 검증에서 전혀 커버되지 않는다. `lib/format.test.ts` 부재. (핸드오프 AC가 명시적으로 요구하진 않으나, `%p` 규칙이 회귀 위험에 노출됨.)
- `top-product-card.tsx` 컴포넌트 자체에 렌더 테스트가 없다(배지 조건부 렌더, "없음" 폴백, 조건 리스트). 핸드오프가 컴포넌트 테스트를 요구하지 않아 차단 사유는 아니지만, 배지 on/off와 빈 리스트 처리는 헬퍼 레벨에서만 간접 검증된다.
- 실데이터 "두 1위가 같아지는 입력"은 기록 문서에만 있고 테스트가 없다(픽스처 기반 same-leader 테스트만 존재). 핸드오프 Verification은 "기록"만 요구하므로 규정 위반은 아니나, 문서에 적힌 `112,730`·`4.10%` 수치는 자동 검증되지 않는다.
- 이 세션에서 `npm test`(38 pass 주장), `npm run typecheck`, `npm run build`(`check:reviewed` + `next build`)를 재실행하지 못했다(샌드박스가 node/npm 실행 차단). 검증 문서의 통과 주장은 정적 분석으로 뒷받침되나 독립 재현은 안 됨.

## Summary

구현은 핸드오프 Acceptance Criteria를 모두 충족한다. 순수 헬퍼(`findAdvertisedLeader`, `buildTopProductSummary`)는 결정적이고 React 의존이 없으며, `buildRanking`의 tie-break 패턴을 정확히 재사용한다. 카드는 `rankingRows[0]` 값을 재계산 없이 표시하고, `excluded` 조건은 구조적으로 배제되며, 배지는 색상+텍스트로 의미를 전달하고 조건부로만 렌더된다. 변경 범위는 허용된 6개 파일로 한정되고 금지 파일·`buildRanking` 본문은 무결하다. 실데이터(`products.json`)가 테스트 단언과 일치함을 확인했다.

차단 사유 없음. 남은 것은 (1) 주석의 `F-08`/`F-09` 라벨 정리, (2) `formatRateBpPercentPoint` 및 컴포넌트 렌더에 대한 테스트 보강 권장, (3) 이 세션에서 실행 검증을 재현하지 못한 점(샌드박스 제약)뿐이다.