## Findings

**1. `ProductList` 공개 시그니처 변경 — 핸드오프의 명시적 제약 위반 (경미, 문서화됨)**
핸드오프는 "`app/_components/calculator.tsx` … 기존 입력 요약 블록과 `<ProductList />`는 그대로 둔다"라고 못박았고, "수정할 것" 목록에 `product-list.tsx`가 없다. 구현은 `ProductList`가 `useProducts()`를 직접 호출하던 것을 제거하고 `products: ProductsState` prop을 받도록 바꿨으며, `use-products.ts`에 `ProductsState` 타입을 새로 export했다. 이유(= `Calculator`가 같은 데이터를 쓰므로 `/api/products` 중복 요청 방지)는 타당하고 `docs/records/2026-09-06-...md`에 "Decisions"로 남겼다. AC를 깨지는 않으나, 설계 결정 규칙("다르게 가려면 먼저 알릴 것")에 따라 리뷰어가 수용 여부를 명시적으로 승인해야 하는 항목이다. 대안(변경 없이 두 번 fetch)은 실측상 초기 `no-store` 요청이 2회 발생하므로 현재 선택이 더 낫다 — 수용 권장.

**2. T5 실데이터 부재 시 skip 경로가 요구대로 동작하지 않음 (경미, 테스트 파일)**
`lib/my-rate.test.ts`의 3개 테스트가 `if (!product) { return it.skip('...') }` 패턴을 쓴다. 실행 중인 테스트 콜백 안에서 `it.skip(name)`(fn 없음)을 호출하면 현재 테스트가 skip으로 표시되는 게 아니라 별도의 skip 서브테스트가 등록되고 부모 테스트는 그대로 pass로 끝난다. 핸드오프 함정("없으면 실패가 아니라 명시적으로 skip")의 의도(실패 방지)는 충족되지만 메커니즘이 부정확하다. `010200100070`이 데이터에 존재해 현재는 트리거되지 않음. 권장: `it('...', { skip: !product }, ...)` 형태 또는 상위에서 조건부 정의.

## Questions

1. `unexplainedBp` 정의 불일치(파이프라인은 `OTHER` 포함 + 갭 최대 옵션 기준, `my-rate`는 `OTHER` 제외 + 사용자 선택 옵션 기준)를 이슈 #8로 실제 등록했는가? 검증 기록에는 "remains for issue #8"이라고만 되어 있고 이슈 링크가 없다.
2. `findRateOption`이 `intrRateType`(단리/월복리)을 매칭 기준에서 제외한다. 현재 데이터로는 `(상품, 만기, 적립방식)`당 옵션이 0/1개라 안전하지만, #4 이자 엔진이 단리/월복리를 구분해야 하므로 이 헬퍼가 그대로 재사용되면 문제가 될 수 있다. #4에서 별도 처리로 합의됐는가?
3. 설계 결정 8의 임시 readout이 "상위 3건"만 표시한다. 8종 전부 체크 시 `010200100070`은 클램프되지만 상위 3건에 안 보일 수 있다(기록도 인정). 수동 검증 7의 "3.15%에서 더 오르지 않는 것을 눈으로 확인"이 실제로 가능했는지 스크린샷으로 확인이 필요하다.

## Test Gaps

- `toBp`, `isCountable`가 직접 단위 테스트되지 않음(불변식 테스트로 간접 검증만). 특히 `toBp(2.45) === 245` 같은 함정 케이스의 직접 assert가 없다 — `T5 clamps synthetic rates`의 `clampedAwayBp === 85`로 간접 커버되긴 한다.
- `assert.equal(productsWithUnexplainedRate.length, 8)`와 `010200100070` 존재 가정이 현재 `data/products.json`에 강하게 결합돼 있다. 데이터 갱신 시 로직이 옳아도 실패한다(함정에서 경고한 결합의 변형).
- `app/_components/calculator.tsx`의 preview 렌더링·정렬 로직에 대한 자동 테스트 없음(임시 UI라 수용 가능, 기록상 수동 검증됨).
- 미지 코드 정렬 순서가 모듈(`?? CONDITION_CODES.length` → 맨 뒤)과 테스트 헬퍼(`indexOf` → `-1` → 맨 앞)에서 다르다. 현재 데이터엔 미지 코드가 없어 죽은 경로.
- `npm run build`는 내가 직접 검증하지 못함(샌드박스 tsx IPC 제약). 기록은 샌드박스 밖에서 통과 및 `check:reviewed` 선행을 확인했다고 주장.

## Summary

핵심 순수 모듈 `lib/my-rate.ts`는 AC를 충실히 만족한다. bp 정수 산술(`Math.round` 경계화, 정수 합·클램프 후 `/100`), 옵션 단위 계산, 양방향 클램프(`max(base, min(unclamped, max))`), `OTHER`·`rateBp===0` 제외 + 3버킷(applied/unapplied/excluded) 분할, `CONDITION_CODES` → 원본 인덱스 순 결정적 정렬, 원본 `SpecialCondition` 참조 보존, `findRateOption` null 반환 — 모두 스펙대로 구현됐다. 내가 직접 `npm test`(15/15 pass, `@/` 별칭이 tsx 런타임에서 정상 해석됨)와 `npm run typecheck`(통과)를 실행해 확인했다. `010200100070` 12개월/정액에서 `clamped===true`, `myRate===3.15`, `clampedAwayBp===10`, `appliedBp===70`(OTHER 2행 제외) 검증됨. `data/products.json`·`lib/types.ts`·`lib/calc-input.ts`·`lib/conditions.ts`·`scripts/**` 미수정, `package.json`은 `test` 스크립트만 추가.

발견된 문제는 모두 경미하다: (1) `ProductList` 시그니처 변경이 핸드오프의 "그대로 둔다"를 벗어나지만 중복 fetch 방지라는 합당한 이유가 있고 기록에 남았다 — 리뷰어 승인만 받으면 수용 가능, (2) 테스트의 `it.skip` 사용법이 부정확하나 실데이터가 존재해 현재 영향 없음. 병합을 막을 correctness 버그는 없음. 조건부 승인 권장 — Questions의 #1(이슈 #8 등록 여부) 확인 후.