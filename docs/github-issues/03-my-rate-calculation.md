## Summary

상품별 기본금리와 사용자가 충족한 우대조건을 기반으로 내 금리를 계산한다.

## Spec Reference

- F-03 내 금리 산정
- 3. 표준 우대조건 코드
- 6. 데이터 모델
- 7.5 검증 테스트 T5~T7

## Scope

- `myRate = baseRate + Σ(rateBp)` 계산 구현
- 사용자가 체크한 조건 중 상품이 제공하는 조건만 적용
- `OTHER` 및 `rateBp === 0` 조건 계산 제외
- `maxRate` 초과 방지 상한 클램프
- 적용 조건 목록과 미적용 조건 목록 반환

## Acceptance Criteria

- [ ] 조건 0개 선택 시 `myRate == baseRate`이다.
- [ ] 모든 조건을 선택해도 `myRate <= maxRate`이다.
- [ ] `OTHER` 조건은 내 금리에 가산되지 않는다.
- [ ] 상품이 제공하지 않는 조건은 내 금리에 가산되지 않는다.
- [ ] 적용/미적용 조건 목록이 상세 화면에서 사용할 수 있는 형태로 반환된다.

## Verification

- [ ] T5 myRate 상한 클램프 테스트
- [ ] T6 조건 0개 선택 테스트
- [ ] T7 미해석 우대폭 존재 시 maxRate 미도달 테스트
