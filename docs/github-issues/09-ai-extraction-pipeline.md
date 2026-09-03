## Summary

빌드 타임 우대조건 AI 추출 파이프라인과 검증 규칙을 구현한다.

## Spec Reference

- 8. AI 파이프라인 명세
- 6. 데이터 모델

## Scope

- `spcl_cnd` 원문 1건과 기본/최고금리를 입력으로 조건 추출
- `SpecialCondition[]` JSON 출력 처리
- JSON 파싱 실패 시 1회 재시도
- evidence 부분 문자열 검증
- 추출 우대폭 합계가 우대갭을 초과하면 low confidence 처리
- `unexplainedBp` 계산
- `reviewed: true` 완료 전 배포 빌드 실패 처리

## Acceptance Criteria

- [ ] 추출 결과는 `SpecialCondition[]` 타입을 만족한다.
- [ ] `evidence`가 원문 부분 문자열이 아니면 해당 항목을 폐기한다.
- [ ] `Σ rateBp > G * 100`이면 수동 검수 대상으로 분류된다.
- [ ] `rateBp === 0` 조건은 계산 제외 대상으로 남는다.
- [ ] 검수 미완료 상품이 있으면 배포 빌드가 실패한다.

## Verification

- [ ] 정상 추출 샘플 테스트
- [ ] JSON 파싱 실패 재시도 테스트
- [ ] evidence 검증 테스트
- [ ] reviewed 빌드 가드 테스트
