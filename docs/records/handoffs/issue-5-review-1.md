CLAUDE.md 및 관련 파일(`lib/ranking.ts`, `lib/my-rate.ts`, `lib/interest.ts`, `lib/calc-input.ts`, `lib/conditions.ts`, `lib/types.ts`, `lib/format.ts`, `app/_components/calculator.tsx`, `app/_components/ranking-table.tsx`, `lib/ranking.test.ts`, `tsconfig.json`, `REALRATE_기능명세서.md` §4/F-05, 검증 문서)을 읽고 Acceptance Criteria 기준으로 리뷰했다. 샌드박스 제약으로 `npm test`/`typecheck`/`build`는 직접 실행하지 못했다(git 외 명령 승인 거부).

## Findings

1. **`finPrdtCd` tie-break가 로케일 의존적이다 (경미).** `lib/ranking.ts:58`이 `a.finPrdtCd.localeCompare(b.finPrdtCd)`를 로케일/옵션 인자 없이 호출한다. AC는 "`finPrdtCd` 오름차순으로 결정적"을 요구한다. `localeCompare`는 런타임 기본 로케일(`LANG`/`LC_ALL`/ICU)에 따라 구두점(하이픈) 처리가 달라질 수 있어, 환경이 바뀌면(로컬 vs CI) `afterTaxInterest`·`baseRate`가 모두 동일한 행들의 순서가 이론상 달라질 수 있다. 실데이터(`10-01-30-031-0036` vs `TD11330030000` 형태)에서 실제로 순서가 뒤집힐 가능성은 매우 낮지만, 완전한 결정성을 위해서는 `a.finPrdtCd < b.finPrdtCd ? -1 : a.finPrdtCd > b.finPrdtCd ? 1 : 0` 같은 코드포인트 비교가 맞다. 영향 범위는 3차 tie-break로 한정되며 랭킹의 상위 의미를 훼손하지 않는다.

그 외 AC 항목은 모두 충족한다:
- `lib/ranking.ts`는 `calc-input`/`interest`/`my-rate`/`types`만 import하는 순수 모듈, `'use client'` 없음. `calc-input`→`conditions`→`types` 체인에도 React 없음.
- 필터: `findRateOption`(기간+적립방식) 반환 상품만 포함 (`ranking.ts:23-24`).
- 정렬: `afterTaxInterest` desc → `option.baseRate` desc → `finPrdtCd` (`ranking.ts:49-59`).
- `annualRate = myRateBp / 10000`, `interestType = option.intrRateType` (`ranking.ts:30-31`).
- 행 데이터: `rank`(1부터, `ranking.ts:62`), `companyName`, `productName`, `maxRate`, `myRate`, `afterTaxInterest`.
- 테이블: `<table>`/`<caption>`/`<th scope="col">`, `formatKrw`로 천 단위 구분 (`ranking-table.tsx:30-53,67`).
- `calculator.tsx:18-31` `useMemo` 의존성 = `monthlyAmount`, `reserveType`, `selectedConditions`, `termMonths`, `products.data`, `products.status` (핸드오프 명세와 정확히 일치, 제출 버튼 없음).
- 빈 상태: `rows.length === 0`이면 안내 문구만 렌더, 헤더 없음 (`ranking-table.tsx:24-27`).
- 임시 "내 금리 상위 미리보기" 제거, 커밋된 입력 요약 섹션(`calculator.tsx:46-62`) 유지.
- `git diff --stat HEAD~1 HEAD` 결과 변경 파일은 `lib/ranking.ts`, `lib/ranking.test.ts`, `app/_components/ranking-table.tsx`, `app/_components/calculator.tsx`, 기록 문서 5개뿐. 금지 파일·`data/products.json`·`next-env.d.ts` 변경 없음.

## Questions

1. 이 세션에서 명령 실행이 거부되어 `npm test`(31 pass 주장), `npm run typecheck`, `npm run build`를 독립 검증하지 못했다. 리뷰어로서 통과 여부를 재확인해야 한다.
2. "광고금리" 컬럼이 매칭된 옵션의 `maxRate`다. 검증 문서는 F-06(#6, 광고 1위 vs 내 조건 1위)에 이 랭킹 출력이 충분하다고 적었으나, `RankingRow`는 선택된 기간/적립방식 옵션의 `maxRate`만 담고 상품 전체의 광고 최고금리(다른 기간 옵션 포함)는 담지 않는다. #6에서 "광고 1위"를 이 값으로 판단해도 되는지 확인 필요.
3. `reserveType`가 `F`(자유적립)일 때 `calculateInterest`는 정액 공식을 그대로 쓴다(범위 밖으로 명시됨). F 선택 시 랭킹 값이 정액 가정으로 계산된다는 점이 #6/#7 진행자에게 전달되었는지 확인 필요 — 검증 문서 "Notes For Follow-Up"에는 이 한계가 언급되지 않았다.

## Test Gaps

1. `reserveType: 'F'`로 `buildRanking`을 호출하는 케이스가 전혀 없다. F 옵션만 있는 상품이 S 선택 시 제외되는 것만 검증하고, F를 실제로 선택했을 때의 필터/정렬 동작은 미검증.
2. 매칭 0건일 때 `buildRanking`이 `[]`를 반환하는지에 대한 모듈 레벨 단언이 없다. 빈 상태 UI AC는 컴포넌트 테스트 하네스가 저장소에 없어 수동 확인에만 의존한다(기존 관행과 일치하지만 기록 필요).
3. `finPrdtCd` tie-break 검증(`assertSortedByRankingRules`의 `previous.finPrdtCd.localeCompare(current.finPrdtCd) <= 0`)이 구현과 동일한 `localeCompare`를 쓰는 순환 단언이라, 정렬 의미가 AC의 "코드포인트 오름차순" 의도와 어긋나도 잡히지 않는다.
4. Verification 체크리스트의 필수 케이스 (a)~(f)는 모두 존재하고, 실데이터+픽스처 병행 요구도 충족한다.

## Summary

구현은 원래 핸드오프의 Acceptance Criteria를 사실상 모두 충족한다. 순수 모듈 분리, 필터, 3단계 정렬, `myRateBp/10000`·`intrRateType` 연동, 행 스키마, 시맨틱 테이블, `useMemo` 의존성, 임시 섹션 교체, 변경 범위 제한 모두 확인됐다. 유일한 코드 지적은 `finPrdtCd` tie-break의 `localeCompare` 사용이 AC의 "결정적" 요구에 비해 로케일 의존적이라는 경미한 문제이며, 실데이터에서 순서가 실제로 뒤집힐 가능성은 낮다. 테스트 갭은 `reserveType: 'F'` 경로 미검증과 tie-break 단언의 순환성 정도다. `npm test`/`typecheck`/`build`는 이 세션에서 직접 검증하지 못했으므로 병합 전 재실행 권장.