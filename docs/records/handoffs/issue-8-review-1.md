## Findings

없음.

diff는 원래 핸드오프의 Acceptance Criteria와 Constraints를 모두 충족한다. 확인한 내용:

- **F-08 evidence 표시**: `ConditionList`가 `applied`/`unapplied` 각 항목에 `condition.evidence`를 `<p className="whitespace-pre-wrap">`로 렌더. 런타임 재가공 없음. (`top-product-card.tsx:34-36`)
- **AI 해석 배지**: 텍스트 배지로 렌더, 색상 의존 아님. `excluded`가 비어 배지가 0개인 케이스도 테스트로 고정(`doesNotMatch(/AI 해석/)`). (`top-product-card.tsx:30-32`)
- **원문 토글**: native `<details><summary>근거 원문 보기 ▾`, `whitespace-pre-wrap`으로 개행 보존, JS 불필요. `'use client'`/`useState` 미사용. (`top-product-card.tsx:124-131`)
- **F-09 고지**: `myLeader.unexplainedBp > 5` strict 비교, 문구는 명세 §5 F-09 원문과 일치, `formatRateBpPercentPoint(unexplainedBp)` 사용. JSX 줄바꿈은 단일 공백으로 정규화되어 문구 무결. 요약 라벨 `미해석 우대폭 {N}%p (미반영)`은 §4 목업 허용 형태. (`top-product-card.tsx:49-50, 114-122`)
- **임계값**: `data/products.json`에 `unexplainedBp: 5` 상품 1건 존재 → 미표시 대상. 테스트가 `5` 미렌더 / `60` 렌더로 고정. (`top-product-card.test.ts:129-141`)
- **금리 미가산**: `calculateMyRate`는 `unexplainedBp` 미참조(코드 확인, `my-rate.ts:70-72`). `buildRanking`은 `product`에서 값만 복사(`ranking.ts:53-54`). 회귀 테스트 2건 추가(`my-rate.test.ts:255-256`, `ranking.test.ts:270-282`).
- **기존 동작 보존**: `excluded`는 여전히 조건 목록에 미렌더(`ConditionList`에 `applied`/`unapplied`만 전달). 신규 필수 필드는 5개 테스트 픽스처(`my-rate`, `ranking`, `action-list`, `action-list-card`, `top-product-card`)에 모두 반영됨.
- **모듈 순수성**: `lib/ranking.ts`에 `react`/`next` import 추가 없음. `formatRateBpPercentPoint` 재사용.
- 데이터 확인: 43개 상품, `unexplainedBp` 비영 8건(5/50/60/90/220/250/400/600), `evidence` 빈 문자열 0건, `rawSpecialCondition` 빈 문자열 0건.

## Questions

1. **F-09 고지가 현재 실데이터로는 도달 불가.** 검증 기록에 따르면 6/12/24/36개월 × 적립방식 × 납입액 × 256개 조건 부분집합을 전수 탐색해도 `unexplainedBp > 5`인 상품이 세후 1위가 되는 입력이 없다. 즉 이 고지 블록은 현재 프로덕션에서 절대 렌더되지 않고 합성 테스트 row로만 커버된다. 미래 데이터 대비 구현으로서는 정당하나, 의도한 상태인지 확인 필요. (랭킹 1위가 아닌 상품에도 상세 카드에서 고지를 보여줄 의도는 없었는지 — 현재는 `myLeader` = `rows[0]`에만 적용.)
2. `confidence: 'low'` 항목 39건에 대한 별도 시각 처리를 생략했는데(핸드오프상 재량 허용), 검수 미완 데이터를 사용자가 구분할 수 없어도 무방한지 확인.

## Test Gaps

- **임계값 바로 위 미검증**: `top-product-card.test.ts`의 F-09 테스트가 `5`(미렌더) vs `60`(렌더)만 확인한다. `> 5` strict 경계를 정확히 고정하려면 `6`(렌더)도 검증하는 편이 좋다. 현재 테스트는 `>= 5`가 아님만 배제하고 `> 5` 자체는 못 박지 않는다.
- **실데이터 흐름 통합 테스트 부재**: `data/products.json`의 실제 상품 `evidence`/`rawSpecialCondition`가 `buildRanking` → `TopProductCard` 경로로 마크업까지 도달하는지에 대한 테스트가 없다(전부 합성 픽스처). 검증 기록의 데모 케이스(`10-01-30-031-0036`)는 육안 확인만 서술.
- **수동 검증 2건 미수행**: (a) `unexplainedBp > 5` 상품이 1위가 되는 입력을 통한 고지 문구 육안 확인 — 위 Question 1 사유로 불가, 기록됨. (b) 375px 모바일 폭 레이아웃 + WCAG AA 명도 대비 — Playwright 부재로 미수행, 기록됨. 두 건 모두 핸드오프가 "사유 기록"을 허용하나, 배지/토글/고지 블록이 실제 뷰포트에서 검증된 바 없음은 남는 리스크.
- **빈 문자열 방어 없음**: `evidence` 또는 `rawSpecialCondition`가 빈 문자열이면 빈 `<p>` / 빈 `<details>` 본문이 렌더된다. 현재 데이터는 전부 비어있지 않아 문제없으나 회귀 방지 가드/테스트는 없다.

## Summary

핸드오프의 모든 Acceptance Criteria가 코드와 테스트로 충족되었고 Constraints 위반은 발견되지 않았다. 구현은 명세 F-08/F-09/§8.2 요구와 일치하며, `TopProductCard`의 순수 컴포넌트 성질과 `renderToStaticMarkup` 테스트 방식, `unexplainedBp` 금리 경로 격리를 모두 유지한다. 코드 결함은 없다.

주된 관찰점은 결함이 아니라 검증 한계다: F-09 고지는 현재 실데이터상 어떤 입력으로도 랭킹 1위에 `unexplainedBp > 5` 상품이 오지 않아 프로덕션에서 도달 불가능하며, 합성 테스트로만 커버된다. 이 의도 여부와 low-confidence 항목 시각 처리 생략을 확인하면 좋겠다. 테스트 측면에서는 `> 5` strict 경계의 바로 위 값 검증과 실데이터 통합 렌더 테스트를 추가하면 회귀 방어가 견고해진다. `npm test`/`typecheck`/`build`는 권한 제약으로 이 리뷰에서 직접 재실행하지 못했고, 핸드오프에 보고된 통과 결과(54 tests)에 의존한다.