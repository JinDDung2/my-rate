## Summary

`data/products.json` 기반으로 적금 상품 데이터를 로드하고, 데이터 기준월과 로드 실패 상태를 처리한다.

## Spec Reference

- F-01 상품 데이터 로드
- 6. 데이터 모델
- 9. API 명세 `GET /api/products`

## Scope

- `Product`, `RateOption`, `SpecialCondition`, `ConditionCode` 타입 정의
- `data/products.json` 로드 경로 구현
- `/api/products` 응답 형식 구현
- 데이터 기준월 `disclosureMonth` 표시 가능한 구조 제공
- 로드 실패 시 재시도 가능한 에러 상태 제공

## Acceptance Criteria

- [ ] 페이지 진입 시 상품 목록을 불러온다.
- [ ] 응답은 `{ disclosureMonth, products }` 형태를 따른다.
- [ ] 상품 원문 우대조건 `rawSpecialCondition`이 보존된다.
- [ ] 로드 실패 시 "데이터를 불러오지 못했습니다" 문구와 재시도 버튼이 노출된다.
- [ ] 재시도 버튼 클릭 시 데이터 로드를 다시 시도한다.

## Verification

- [ ] 정상 데이터 로드 수동 확인
- [ ] 실패 상태 수동 확인
- [ ] 타입 체크 통과
