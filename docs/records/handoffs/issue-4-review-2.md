## Findings

1. **검증 기록의 T1 raw 값이 사실과 다르다** — `docs/records/2026-09-06-interest-engine-verification.md`가 T1 반올림 전 값을 `100000 * (0.03 / 12) * 12 * 13 / 2 = 19500`로 적었다. 핸드오프 Verification이 명시적으로 요구한 항목("T1: 반올림 전 raw 세전이자 값도 함께 기록 — `19499.99…` 인지 `19500.0…2` 인지 — 반올림 1회의 근거")을 충족하지 못한다. `0.03/12`는 double로 `0.0025`보다 약간 작게 표현되므로 실제 raw는 `19499.9999…` 부근이고, "반올림 최종 1회"라는 설계 근거 자체가 raw ≠ 19500이라는 전제 위에 있다. 기록이 이 값을 이상적 정수로 뭉개서 설계 결정의 핵심 증거가 문서에 남지 않았다. (코드 결함 아님, 필수 산출물인 검증 기록의 부정확성.) 기록의 T2도 동일하게 raw를 `1000`으로만 적었다.

2. **`git diff --stat` 범위 확인 결과는 정상** — 변경은 `lib/interest.ts`, `lib/interest.test.ts`, `docs/records/` 2개 문서뿐. `package.json` / `tsconfig.json` / `lib/types.ts` / `data/products.json` / `app/**` / `scripts/**` 무변경. (문제 없음, 확인차 명시.)

코드 자체(`lib/interest.ts`)는 §7.1~7.4 수식과 AC를 전부 충족한다: 순수 모듈(`import type { RateOption }`만), `Math.round` 세전이자 1곳, `i === 0` early return으로 T4/0除算 회피, 세금·세후·만기 파생이 반올림된 정수에서만 이뤄져 5필드 정수성 유지, `interestType`이 `RateOption['intrRateType']` 재사용, `rsrvType` 미수용. 복리식은 `만기금액 − principal` 후 1회 반올림으로 §7.2와 일치하고, `maturityAmount`는 만기금액이 아니라 `원금 + 세후이자`(만기수령액)로 올바르다.

## Questions

1. T3 경계 케이스(`P=10000, n=12, r=0.0003`)의 `M=20`과 복리 pin(`P=100000, n=36, r=0.05 → 291481`)은 `(1+i) ** n`(`Math.pow`)에 의존한다. `Math.pow`는 엔진/플랫폼 간 최대 1 ULP 차이가 허용되므로, CI 러너의 Node 버전이 개발 환경(v26.3.1)과 다를 때 이 상수 단언이 깨질 여지가 있다 — 이 값들을 정확 상수로 못박는 게 의도인가, 아니면 `19 <= x <= 21` 같은 허용범위가 더 안전한가? (단리 케이스는 `**` 미사용이라 IEEE754 결정적이므로 무관.)
2. `npm test` / `npm run typecheck` / `npm run build`를 이 세션에서 직접 실행할 수 없었다(승인 거부). Codex 보고(23/23 pass, build는 샌드박스 밖 재실행 통과)를 신뢰하는 것으로 충분한가, 아니면 재검증이 필요한가?

## Test Gaps

1. **매트릭스 테스트가 단조성을 검증하지 않는다** — `keeps rounded pretax interest stable across common floating point edges`는 `r×n×P` 12조합 × `S`/`M` 각각을 계산하지만 같은 조합의 `M >= S`를 대조하지 않는다. 단조성(T3, AC 항목)은 손으로 고른 4조합에서만 확인된다. 이미 두 결과를 다 계산하므로 루프에 `assert.ok(compound.pretaxInterest >= simple.pretaxInterest)` 한 줄 추가하면 전 매트릭스로 커버된다.
2. **`Math.round` 1회 제약이 테스트로 걸려 있지 않다** — AC "소스에 `Math.round` 호출이 세전이자 1곳에만"은 수동 검토에만 의존한다. 소스 문자열 grep 단언이 없어 향후 회귀 방지가 안 된다.
3. **핸드오프가 명시한 "`Math.round` 재적용 시 불변" 단언이 제거됐다** — Codex가 "항상 참에 가까움"으로 삭제. `Number.isInteger(pretaxInterest)`가 여전히 단언되어 실질 커버리지는 동등하므로 수용 가능하나, 핸드오프 테스트 명세와의 차이가 검증 기록에 이유와 함께 남아 있는 점은 확인함.
4. `annualRate < 0`은 설계 결정 4에서 "별도 처리 안 함"으로 고정됐고 테스트도 없다 — 범위상 정상이나, 음수 `r`에서 음수 세금이 나오는 동작이 문서화되지 않았다. #5에서 `myRateBp`가 음수가 될 수 없음을 호출부가 보장해야 한다는 점을 검증 기록의 "Notes For Issue #5"에 추가하면 좋다.

## Summary

`lib/interest.ts` 구현은 §7 수식과 이슈 AC를 정확히 충족한다 — 순수 모듈, 반올림 1회, `i===0` 가드, 파생값 정수성, 타입 재사용 모두 통과. 스코프도 깨끗하다(금지 파일 무변경). 코드 자체에 결함은 발견되지 않았다.

다만 (1) 필수 산출물인 검증 기록이 핸드오프가 명시적으로 요구한 T1/T2 "반올림 전 raw 값"을 이상적 정수로 잘못 적어 "반올림 1회" 설계의 핵심 증거를 남기지 못했고, (2) 매트릭스 테스트가 단조성을 대조하지 않아 T3 커버리지가 4조합에 국한된다. 둘 다 코드 재작성 없이 문서 1줄·테스트 1줄 수정으로 해소된다. `npm test/typecheck/build`는 이 세션에서 직접 실행하지 못해 Codex 보고에 의존한다.