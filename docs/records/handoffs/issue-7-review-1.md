## Findings

1. **`app/_components/action-list-card.tsx:37` — 조사 "를" 하드코딩으로 자음 종결 라벨에서 비문 발생 (경미).** 문구가 `{action.label}를 추가하면`으로 고정되어 있어 자음으로 끝나는 라벨에서 틀린다: `카드 실적를`(→ 실적을), `비대면 가입를`(→ 가입을), `앱 미션/출석를`(→ 출석을). 스펙 목업(`급여이체를…`)과 핸드오프 A3의 리터럴 형식은 모음 종결 라벨만 노출했고, A3는 "최종 문구/마크업 세부는 Codex 재량"이라 재량 범위에서 고쳐야 했다. `lib/action-list-card.test.ts:100` 이 틀린 형태(`/카드 실적를 추가하면/`)를 그대로 고정하고 있어 회귀 방지도 안 된다. 조사 헬퍼(받침 유무 분기)로 처리 권장.

그 외 Acceptance Criteria 항목은 모두 충족한다:
- `lib/action-list.ts`는 react/next import 없는 순수 모듈, baseline을 내부에서 `calculateMyRate(product, option, input.selectedConditions)`로 재계산, 이자 규약(`myRateBp / 10000`, `option.intrRateType`)이 `lib/ranking.ts`와 동일 → baseline 세후이자 일치.
- 후보는 `baselineMyRate.unapplied`에서만 도출, `Map`으로 코드 단위 dedup + `rateBp` 합산, 시뮬레이션 조건 집합은 정확히 `selectedConditions + 코드 1개`(조합 없음, `calculateMyRate`가 `Set` 사용이라 중복 무해).
- 정렬: delta 내림차순 → `CONDITION_CODES` 순서 tie-break(안정 정렬 + 삽입순서가 이미 조건순), 필터 `> 0`, `MAX_ACTIONS = 3` slice → 결정적.
- 클램프(전체/부분) 처리 정확, 정수 유지(추가 반올림 없음).
- `ActionListItem`에 `{ code, label, rateBp, afterTaxInterestDelta }` 모두 포함, `label`은 `CONDITION_META[code].label`.
- `ActionListCard`가 `rankingRows[0].finPrdtCd`로 원본 상품 조회, `buildActionList(product, topRow.option, input)` 호출, 상품 미발견/빈 결과 시 `null`, `renderToStaticMarkup` → `''`.
- 금액은 `formatKrw`로 `+…원` 표기, 최대 3행.
- `calculator.tsx`에서 `TopProductCard` 다음, 렌더 조건 `rankingRows && rankingRows.length > 0 && products.status === 'success'`로 배선.
- `git diff` 범위가 요청된 6개 파일(신규 4 + 수정 1 + 기록 문서 1)로 한정, 금지 파일 미수정.
- 검증 기록에 실데이터 덤프(`AUTO_TRANSFER +2,750원`)와 손계산 교차검증, tie-break·빈 배열·A1 가정·확장 지점 기재.

손계산 재검증: 실데이터 baseline `500,000 × (0.036/12) × 78 = 117,000`, 세금 `floor(117,000 × 0.154) = 18,018`, 세후 `98,982` (기록 문서·랭킹 행과 일치). `AUTO_TRANSFER` 추가 시 `120,250 − 18,518 = 101,732`, delta `2,750` 확인. 테스트 파일의 기대값들(2750/2200/1650, 5499, 1100 등)도 수식으로 재현됨.

## Questions

없음.

## Test Gaps

- `lib/action-list.test.ts`의 dedup 케이스가 `actions[0].label`이 `CONDITION_META['AUTO_TRANSFER'].label`(`'자동이체'`)로 해석되는지 단언하지 않는다. `code`/`rateBp`/`delta`만 검증 → 라벨 매핑 회귀는 카드 테스트에 간접 의존.
- `OTHER` 및 `rateBp === 0` 조건이 후보에서 제외되는지 `action-list.test.ts`에서 직접 고정하지 않음(`calculateMyRate.unapplied` 커버리지에 의존). 허용 가능하나 로컬 핀 없음.
- `ActionListCard`가 `TopProductCard` 다음에 온다는 배치는 수동 확인만 존재(핸드오프상 수동 항목이라 허용).

## Summary

핸드오프 Acceptance Criteria와 Verification 요구 케이스를 거의 완전히 충족한다. 계산 로직(baseline 재계산, 코드 dedup, 단일조건 시뮬레이션, 클램프, 결정적 정렬/필터/slice)과 카드 배선·null 처리·`calculator.tsx` 조건이 모두 스펙대로다. 유일한 실질 이슈는 자음 종결 라벨에서 조사 "를"이 비문이 되는 UX 문제(경미)이며, 해당 오탈이 카드 테스트에 고정되어 있다. 나머지는 라벨 미검증 등 사소한 테스트 갭뿐이다.