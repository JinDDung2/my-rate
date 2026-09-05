## Findings

없음. 핸드오프의 Acceptance Criteria를 모두 충족한다.

- 제출 버튼 없음(폼 요소 자체가 없고 스텝 버튼은 `type="button"`), 모든 입력 변경이 `useCalcInput` 상태를 통해 즉시 요약에 반영됨.
- `parseMonthlyAmount`가 `9000`/`1000001` → `out-of-range`, `abc`/빈 문자열 → `not-a-number`/`empty`, `15000` → `not-a-step`(→ "만원 단위로 입력해 주세요")로 정확히 분기. 무효 시 `setAmountText`가 조기 반환하여 `input.monthlyAmount`(커밋값)를 유지. 유효값 재입력 시 경고 해제 + 요약 갱신.
- draft/committed 분리가 `amountText`(문자열)와 `CalcInput.monthlyAmount`(숫자)로 구현되고, 하위 소비자는 `amountText`를 읽지 않음.
- `TERM_OPTIONS = [6,12,24,36] as const` 단일 출처, 데이터 스캔 없음. 라디오 4개 외 경로 없음.
- 적립 방식 라디오 2개가 `ReserveType = RateOption['rsrvType']`(`'S' | 'F'`)로 매핑, 새 유니온 없음.
- 체크 가능한 조건 8종, `checkboxLabel` 문구가 명세서 43–50행과 문자 단위로 일치.
- `CheckableConditionCode = Exclude<ConditionCode,'OTHER'>`가 `selectedConditions`, `toggleCondition`, `onConditionToggle` 전 구간에 적용. `OTHER`는 `input` 요소 없이 `선택 불가` 배지가 붙은 안내 행으로 렌더 → 배열 진입 경로 없음.
- `toggleCondition`이 `CHECKABLE_CONDITION_CODES.filter(...)`로 항상 `CONDITION_CODES` 순서 정렬 → 체크 순서 무관 결정적 배열.
- 금액 표시(`계산 적용 금액`, 커밋 요약)에 `formatKrw`(`Intl.NumberFormat('ko-KR')`) 적용.
- amount `<label htmlFor>`, term/reserve/condition 각 `fieldset` + `legend`, 경고 `role="alert"` + 조건부 `aria-describedby="monthly-amount-error monthly-amount-help"`.
- 390px에서 모든 그리드가 1열(기간만 2×2), 인터랙티브 요소 `min-h-12`/`h-12`(≈48px).
- `npm run typecheck` 통과(직접 실행 확인). `package.json` dependencies 변화 없음. 신규 `fetch`/네트워크 코드 없음. `build` 스크립트(`check:reviewed && next build`) 미변경.
- Tailwind `has-[]` / `min-h-12`는 `tailwindcss@3.4.17`에서 지원됨. 새 컴포넌트는 `app/_components/` 아래 → `content` 글롭 커버.

## Questions

- 금액 입력창은 타이핑/스텝 후 원시 숫자(`500000`)를 표시하고 콤마는 보조 표기(`계산 적용 금액`)와 요약에만 적용된다. 핸드오프가 허용한 경로이나, 대회 UI에서 blur 시점 포맷을 추가로 원하는지 확인 필요.
- `커밋된 입력 요약` 섹션은 #5에서 교체될 임시 출력인데 임시임을 표시하는 주석이 없다(핸드오프는 매칭 건수 포함 시에만 주석을 요구). 이 문구/섹션을 그대로 배포해도 되는지 확인.

## Test Gaps

- 테스트 러너 미도입(#4 소관)이라 `lib/calc-input.ts` 순수 함수 자동 커버리지 0: `parseMonthlyAmount`의 각 `reason` 분기·공백/콤마/안전정수 초과, `toggleCondition` 정렬·2회 토글 멱등, `clampMonthlyAmount` 경계.
- `useCalcInput`의 draft/committed 분리, `stepAmount` 경계값(하/상한 클램프) 및 "무효 텍스트에서 스텝 → 커밋값 복구" 동작은 수동(CDP)만 검증됨, 회귀 보호 없음.
- 접근성(label 연결, fieldset/legend, `role="alert"`, Tab 순회, 390px)은 수동 확인만. axe 등 자동 검사 없음.
- `parseMonthlyAmount`의 `/^[\d,]+$/`는 `1,0,0,000` 같은 비정상 콤마 그룹도 통과시킨다(현재는 무해하나 미검증).
- `build`/`dev` 기반 검증(즉시 갱신·네트워크 0건·production 서버)은 Codex 리포트 기록에 의존, 이번 리뷰에서 재실행하지 않음.

## Summary

AC 위반 없음. 타입 체크는 직접 실행해 통과 확인했고, 나머지 빌드/브라우저/네트워크 검증은 Codex 리포트 기록 기준이다. 콤마 포맷은 입력창 밖(보조 표기+요약), `OTHER`는 `input` 없는 안내 행 + `선택 불가` 배지, 선택 옵션인 "매칭 상품 건수"는 미포함으로 모두 핸드오프 지침과 일치한다. 유일한 명시적 이탈은 `app/_components/product-list.tsx`의 제목 레벨 변경(h1→h2, h2→h3)으로, "app/page.tsx 조립만 변경" 가이드를 벗어나지만 제목 계층 정합을 위한 것이고 동작 변화가 없으며 검증 문서에 공개돼 있어 수용 가능하다.