## Findings

없음.

10개 Acceptance Criteria + 구현 제약 전부를 정적 검토 기준으로 충족한다. 확인 내역:

- **순수 모듈**: `lib/ranking.ts`는 `@/lib/calc-input`, `@/lib/interest`, `@/lib/my-rate`, `@/lib/types`만 import. React/Next 없음. `'use client'` 없음. (`lib/ranking.ts:1-4`)
- **필터**: `findRateOption(product, input.termMonths, input.reserveType)`가 `null`이면 `flatMap`에서 `[]` 반환 → 기간+적립방식 미매칭 상품 제외. (`lib/ranking.ts:29-30`)
- **정렬**: `afterTaxInterest` desc → `option.baseRate` desc → `finPrdtCd` 코드포인트 asc(`compareCodePointAscending`, `localeCompare` 아님)로 결정적. V8 stable sort와 무관하게 3차 tie-break가 명시돼 있어 안정적. (`lib/ranking.ts:55-65`)
- **이자 산정**: `annualRate: myRateResult.myRateBp / 10000`, `interestType: option.intrRateType` 그대로 전달. `lib/interest.ts` 미변경. (`lib/ranking.ts:33-38`)
- **행 데이터**: `rank`(1부터, `index + 1`), `companyName`, `productName`, `maxRate`(=`option.maxRate`), `myRate`(=`myRateResult.myRate`), `afterTaxInterest`. 추가로 `option`/`myRateResult`/`interest` 전체 객체 보존 → #6/#7 재사용 가능. (`lib/ranking.ts:40-52,67-70`)
- **테이블**: `<table>` + `<caption>`(sr-only) + 6개 `<th scope="col">`(순위/은행/상품명/광고금리/내금리/세후실수령, 명세서 컬럼과 일치). 금액은 `formatKrw(...)` + "원", 금리는 `.toFixed(2)` + "%". 모바일 `overflow-x-auto` + `min-w-[720px]`. slate 톤 유지. (`app/_components/ranking-table.tsx:30-72`)
- **즉시 갱신**: `useMemo` 의존성 `[input.monthlyAmount, input.reserveType, input.selectedConditions, input.termMonths, products.data, products.status]` — 핸드오프 명세와 정확히 일치. `toggleCondition`/`setTermMonths` 등이 새 참조를 만들어 재계산됨. 제출 버튼 없음. (`app/_components/calculator.tsx:18-31`)
- **빈 상태**: `rows.length === 0`이면 안내 문구만 렌더, `<table>` 자체를 렌더하지 않음 → 헤더만 남지 않음. `products.status !== 'success'`이면 `rankingRows === null` → `<RankingTable>` 미렌더(로딩/에러는 `ProductList`에 위임). (`app/_components/ranking-table.tsx:24-27`, `calculator.tsx:18-21,64`)
- **미리보기 교체**: `calculator.tsx:83-118` 임시 "내 금리 상위 미리보기" 섹션 삭제, `<RankingTable>`로 대체. 커밋된 입력 요약 섹션(현재 46-62행) 유지. `calculateMyRate`/`findRateOption` 직접 import 제거. (`calculator.tsx`)
- **변경 범위**: `git show --stat` 결과 두 커밋(9ccb69e, 4a99334)이 건드린 파일은 `lib/ranking.ts`, `lib/ranking.test.ts`, `app/_components/ranking-table.tsx`, `app/_components/calculator.tsx`, `docs/records/2026-09-06-ranking-table-verification.md`뿐. 금지 파일·`data/products.json` 미변경. `next-env.d.ts` 되돌림도 반영됨(작업트리 clean).
- **기록 문서**: tie-break 설계, 기간+적립방식 매칭 결정("가정"), "세후실수령 = 세후이자" 해석, F-06용 데이터 가용성 메모 모두 포함. (`docs/records/2026-09-06-ranking-table-verification.md`)

## Questions

1. `findRateOption`은 `saveTrm`+`rsrvType`가 같은 옵션이 여러 개일 때 `Array.prototype.find`로 **첫 번째**를 취한다. 같은 12개월/정액적립에 단리·월복리 옵션이 동시에 존재하는 상품이 `data/products.json`에 있으면, 랭킹이 세후이자가 더 높은 쪽이 아니라 배열 순서상 먼저 오는 옵션을 쓰게 된다. AC는 "매칭 옵션의 `intrRateType`"이라고만 명시하므로 이 diff는 규격을 지키지만, `findRateOption`은 동결 모듈이고 #3과 동일 동작이라 의도된 것인지 확인 필요. (샌드박스에서 `node` 실행이 거부돼 실데이터에 중복 옵션 그룹이 있는지 직접 확인하지 못함.)
2. `next build`는 ESLint 설정·패키지가 없어 lint를 건너뛰므로 문제 없지만, `useMemo`가 `buildRanking(..., input)`에 `input` 객체 전체를 넘기면서 의존성에는 하위 필드만 나열한다. 향후 ESLint(`react-hooks/exhaustive-deps`)를 도입하면 경고가 난다. 핸드오프가 지정한 의존성 배열이라 이 diff에서 바꿀 건 아니다.

## Test Gaps

- **UI 컴포넌트 테스트 없음**: `RankingTable`의 빈 상태 렌더("테이블 헤더만 남지 않는다"), `<caption>`/`<th scope>` 존재, 천 단위 포맷은 자동 테스트가 없고 기록 문서상 `npm run dev` 수동 확인에만 의존. 프로젝트에 React 테스트 셋업이 없어 `node:test` 관례상 불가피하나, AC의 빈 상태·시맨틱 조건은 코드 리뷰로만 보증됨.
- **375px 반응형 미검증**: 브라우저 자동화 패키지 미설치로 좁은 화면 스크린샷 검증을 못 했다고 기록에 명시됨. `overflow-x-auto` + `min-w-[720px]`는 합리적이나 실측 안 됨.
- **`rank === 1` 명시 검증 약함**: `assertSortedByRankingRules`는 `index >= 1`만 순회해 `rows[0].rank`를 확인하지 않는다. `finPrdtCd deterministic` 테스트에서만 `[1, 2]`를 확인. 실데이터 케이스에서 1위 rank 검증은 없음(경미).
- **실데이터 기간 필터 제외 케이스**: 검증 항목 (a)는 "6/12/24/36 아닌 saveTrm만 가진 상품 제외"인데, `TermMonths` 타입이 `6|12|24|36`으로 제한돼 픽스처(`saveTrm: 18`)로만 커버된다. 실데이터에서 특정 `finPrdtCd`가 6개월 선택 시 빠지는지는 `.every(saveTrm === 12)` 류 간접 확인뿐. 의도된 한계로 보이나 명시.
- **로컬 검증 미실행**: 이 리뷰 환경에서 `npm test` / `npm run typecheck` / `npm run build` 실행이 샌드박스 정책으로 거부됨. 통과 여부는 기록 문서(33 tests pass, typecheck pass, sandbox 밖 build/dev pass) 주장에 의존하며, 정적 검토상 타입·임포트·테스트 로직에 모순은 발견되지 않음.

## Summary

핸드오프의 Acceptance Criteria를 모두 만족한다. `lib/ranking.ts`는 규격대로 순수 모듈이고, 정렬 3단 tie-break(세후이자 → baseRate → finPrdtCd 코드포인트)가 결정적으로 구현됐으며, `myRateBp/10000` 변환과 `option.intrRateType` 전달, 행 데이터 구성, 시맨틱 테이블, `useMemo` 의존성, 빈 상태 처리, 임시 미리보기 교체, 변경 범위 제한이 모두 정확하다. 금지 파일과 `data/products.json`은 그대로다. 테스트는 검증 항목 (a)~(f)를 픽스처+실데이터 병행으로 커버한다. 차단성 결함 없음. 남은 리스크는 (1) `findRateOption` 다중 옵션 시 첫 항목 선택이라는 상속된 동작, (2) UI 레이어의 자동 테스트 부재로 빈 상태·반응형·시맨틱이 수동 확인에만 의존, (3) 이 리뷰 환경에서 `npm test/typecheck/build`를 직접 재현하지 못함 — 세 가지 모두 이 diff 범위 밖이거나 프로젝트 구조상 불가피한 한계다.