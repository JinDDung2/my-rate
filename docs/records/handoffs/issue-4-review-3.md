## Findings

없음.

`lib/interest.ts` / `lib/interest.test.ts` diff를 원래 핸드오프의 Acceptance Criteria 전 항목과 대조한 결과, 기준을 벗어난 구현·누락은 발견하지 못했다.

- 순수 모듈: `import type { RateOption }` 하나뿐, `'use client'` 없음, 상대경로 import. (AC 1, 10)
- §7.1/§7.2 수식이 코드와 일치. 단리 `P*i*(n(n+1))/2`, 월복리 `P*(1+i)*((1+i)^n−1)/i − P*n`. (AC 2·3)
- `Math.round`는 `pretaxInterest` 1곳뿐이고, `tax=floor(pretax*0.154)` → `afterTax`/`maturity`는 정수 뺄셈·덧셈으로만 파생. 5필드 정수성 유지. (AC 8·9)
- `monthlyRate === 0` 가드가 `annualRate===0`(및 `-0`)을 잡아 월복리 0除算을 회피, T4를 S·M 모두 만족. (AC 5)
- `interestType`이 `RateOption['intrRateType']` 재사용, `rsrvType` 미수용. (AC 10)
- 반올림은 비감소 함수이고 raw(월복리) ≥ raw(단리)이므로, 유효 입력 도메인(n∈{6,12,24,36})에서 `round(M) >= round(S)` 단조성이 코드 수준에서 성립. 매트릭스+T3 테스트가 이를 확인. (AC 4)
- `git diff --stat` 범위가 `lib/interest.ts`, `lib/interest.test.ts`, 기록 문서 2건뿐. `package.json`·`tsconfig.json`·`lib/types.ts`·`data/products.json`·`app/**`·`scripts/**` 불변. (AC 11)
- `TAX_RATE = 0.154` 단일 상수, 파라미터 아님.
- T1/T2 raw 값이 V8에서 이미 정확한 정수(19500.0 / 1000.0)로 떨어지는 현상을 검증 문서가 정직하게 기록함(`100000 * (0.03/12)` 가 250.0으로 반올림되어 이후 정수 연산).

## Questions

- `npm run build`(`check:reviewed` → `next build`)를 이 리뷰 환경에서 재현하지 못했다. Codex 보고서상 worktree에 `npm ci` 후에만 통과한다. CI가 worktree 의존성을 설치하는지, 즉 AC의 "build 통과"가 실제로 보장되는지 확인 필요.
- 월복리 pin 값 `291_481`(P=100000/n=36/r=0.05)이 §7.2를 **독립 계산**(스프레드시트 등)으로 구한 값인가, 아니면 `calculateInterest` 출력을 스냅샷한 것인가? 후자라면 회귀 테스트의 오라클로서 가치가 약하다. (파생 세금 `3003`, `44888`은 `floor(pretax*0.154)`로 독립 검증됨 — 문제 없음.)

## Test Gaps

- **음수 `annualRate`**: 코드가 처리하지 않고(설계결정 4), 검증 문서만 "#5 주의점"으로 언급한다. `annualRate < 0 → pretax/tax 음수` 현재 동작을 pin하는 테스트가 없어, #5가 `myRateBp` 음수 클램프를 빠뜨렸을 때 CI가 잡지 못한다.
- **T3 `r=0.0003` 케이스**가 `S===19`, `M===20`으로 raw 19.4999…(19.5 반올림 경계)에 붙어 있다. 단리 분기는 IEEE754 `*`,`/`만 써서 결정적이지만 경계값 pin이라 취약해 보인다. 의도(반올림 경계에서 M>S 벌어짐)를 주석으로 남기거나 덜 아슬아슬한 경계 입력을 쓰는 편이 낫다.
- **단리 분기의 raw(반올림 전) 값 단언 부재**: 매트릭스는 반올림 후 정수성·`Math.round` 재적용 불변만 본다. 중간항을 자르는 회귀가 우연히 같은 정수로 떨어지면 통과할 수 있다. "`Math.round` 1회" 소스 검사가 주 방어선으로 존재하긴 함.
- **`n=1` × `M` 분기** 미커버(T2는 `S`만). 이 지점은 `(1+i)**1 - 1` 정밀도 손실로 raw_M < raw_S 가 이론상 가능하나, `n=1`이 유효 기간 도메인 밖이라 실무상 무해.

## Summary

구현은 §7 수식·"반올림 최종 1회"·세금 규칙·`r=0` 특수처리·`M>=S` 단조성·범위 유지까지 Acceptance Criteria를 모두 충족한다. 코드에서 수정할 결함은 없다. 남은 것은 (1) worktree 빌드 재현성 확인, (2) 월복리 pin 값의 오라클 출처 확인, (3) 음수 금리 동작을 잠그는 테스트 추가 권고 — 셋 다 병합 차단 사유는 아니다.