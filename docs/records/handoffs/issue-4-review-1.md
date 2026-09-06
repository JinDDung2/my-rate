CLAUDE.md 및 관련 문서(스펙 §7, `lib/types.ts`, `lib/my-rate.test.ts`)를 확인했다. Bash 승인이 제한되어 `npm test`/`typecheck`/`build`를 직접 재실행하지 못했고, 아래는 코드·스펙 정적 분석 + Codex가 보고한 22/22 통과 결과를 근거로 한 리뷰다.

## Findings

**없음.**

Acceptance Criteria 전 항목이 충족된다:

- **순수 모듈**: `lib/interest.ts`는 `import type { RateOption } from './types'` 하나뿐. React/Next 의존 0, `'use client'` 없음. ✓
- **T1/T2**: 하드코딩 단언(`19_500`, `1_000`)이 테스트에 존재하고 Math.round 최종 1회로 흡수됨. ✓
- **T3 단조성**: 수학적으로 보장됨 — 사전 반올림 값에서 `compound_raw = P·Σ((1+i)^j − 1) ≥ P·i·Σj = simple_raw` (i ≥ 0, Bernoulli), 그리고 `Math.round`는 단조 비감소 함수라 `round(compound) ≥ round(simple)`. r ≥ 0에서 위반 불가. ✓
- **T4 (r=0)**: `monthlyRate === 0` 가드가 `pretaxInterest/tax/afterTaxInterest = 0`, `maturityAmount = principal` 즉시 반환. S·M 모두 커버. ✓
- **파생값 불변식**: `tax = Math.floor(pretaxInterest * TAX_RATE)`, `afterTaxInterest = pretaxInterest - tax`, `principal = P*n`, `maturityAmount = principal + afterTaxInterest` — 코드와 일치. ✓
- **정수성**: `principal`(정수×정수 ≤ 3.6e7, 정확), `pretaxInterest`(Math.round), `tax`(Math.floor), 나머지 정수 연산. ✓
- **`Math.round` 1곳**: line 40 한 곳뿐. `Math.floor`는 세금용으로 별개(AC 위반 아님). ✓
- **타입 재사용**: `interestType: RateOption['intrRateType']`, 새 유니온 없음, `rsrvType` 미수신. ✓
- **범위**: `git diff --stat`이 신규 4개 파일(`lib/interest.ts`, `lib/interest.test.ts`, 기록 문서 2개)만. `package.json`/`tsconfig.json`/`lib/types.ts`/`data/products.json`/`app/**`/`scripts/**` 무변경. ✓
- **수식 정확성**: 단리 `P·i·n(n+1)/2`, 월복리 `P·(1+i)·((1+i)^n−1)/i − P·n` — 연산자 우선순위 포함 §7.1/§7.2와 일치. ✓
- **`months <= 0` / `monthlyDeposit <= 0` 가드**: 설계 결정 4대로 이자·세금 0, `principal = monthlyDeposit * months` 유지. 테스트에 `params(100_000, -1, ...)` 케이스 포함. ✓

## Questions

- 없음. 설계 결정에서 벗어난 항목 없음(가드가 `i === 0` 조건과 한 `if`로 합쳐졌으나 반환값은 Constraint 4와 정확히 동일).

## Test Gaps

AC는 모두 통과하지만, 회귀 방어력이 약한 지점이 있다(구현 수정 시 참고):

1. **세금 단언이 동어반복**: `assert.equal(result.tax, Math.floor(result.pretaxInterest * TAX_RATE))` — 구현식을 그대로 재계산해 비교하므로, 반올림 전략이 바뀌어도(예: raw 값에 곱하기) 통과할 수 있다. 최소 한 케이스는 상수 기댓값(예: T1에서 `tax === 3003`, `afterTaxInterest === 16497`)을 못박는 게 좋다.
2. **부동소수점 안정성 단언이 공허**: `Math.round(result.pretaxInterest) === result.pretaxInterest`는 이미 `Math.round`를 거친 값이라 절대 실패할 수 없다. 핸드오프가 우려한 `...0000003` 시나리오를 실제로 잡으려면 raw 계산값이나 정확한 유리수와 비교해야 한다. 현재 매트릭스는 "정수인지"만 반복 확인한다.
3. **월복리(`M`) 분기의 구체 기댓값 핀이 전무**: T1/T2는 단리만. 복리식의 부호 오류나 annuity-due↔ordinary 혼동이 생겨도 `M >= S`와 정수성만 만족하면 전 테스트 통과. 최소 1개 `M` 케이스에 상수 `pretaxInterest`/`maturityAmount`를 명시 권장(검증 기록에 `P=100000,n=36,r=0.05 → M=291481` 등 값이 있으니 그대로 단언으로 승격 가능).
4. **T3 경계 케이스 `(10000, 6, 0.000001)`는 S=M=0**이라 단조성 신호가 없다(0 ≥ 0). "작은 r" 경로는 타지만 검증력은 없음 — 반올림 후에도 S와 M이 서로 다른 정수가 되는 경계 입력을 하나 추가하면 의미가 생긴다.

## Summary

구현은 스펙 §7과 핸드오프 Constraint를 정확히 따르며, 모든 Acceptance Criteria를 충족한다. 정정할 결함 없음. `Math.round` 1곳, 세금/파생값은 반올림된 정수에서만 파생, `i === 0` 가드로 0除算 회피, 범위 밖 파일 무변경까지 모두 확인했다. 다만 세금·부동소수점·복리 분기의 여러 단언이 **구현식을 재계산하거나 항상 참인 형태**라 실제 회귀 방어력이 낮다 — 상수 기댓값을 몇 개 못박으면 스위트가 실질적으로 강해진다. (참고: 이 리뷰는 Bash 실행 권한 제한으로 `npm test/typecheck/build`를 직접 재실행하지 못했고, 정적 분석과 Codex 보고 결과에 의존한다.)