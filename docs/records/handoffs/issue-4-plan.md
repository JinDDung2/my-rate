## Goal

`lib/interest.ts` 순수 모듈을 만들어 월 납입액 `P`, 기간 `n`(개월), 연이율 `r`(소수), 이자유형(단리 `S` / 월복리 `M`)으로부터 `{ 원금, 세전이자, 세금, 세후이자, 만기수령액 }`을 계산한다. 계산식은 `REALRATE_기능명세서.md` §7.1~7.4를 그대로 따르고, 원 단위 반올림은 세전이자에 대해 최종 1회만 수행한다.

이 모듈은 #4의 유일한 산출물이다. 화면 배선, 랭킹, 자유적립 실제 납입 모델링은 하지 않는다.

## Context

- 스펙 근거:
  - `REALRATE_기능명세서.md:111-115` — F-04 입력/출력 및 최종 1회 반올림 제약
  - `REALRATE_기능명세서.md:193-227` — §7 계산 규칙과 T1~T7
  - `REALRATE_기능명세서.md:259-266` — 계산은 클라이언트 순수 모듈, 테스트에서 동일 모듈 직접 호출
  - `REALRATE_기능명세서.md:34` — 실수령 이자는 만기 이자에서 이자소득세 15.4%를 차감
- §7 수식:
  - `i = r / 12`, 세율 `t = 0.154`
  - 원금 = `P * n`
  - 단리 세전이자 = `P * i * n(n+1) / 2`
  - 월복리 만기금액 = `P * (1+i) * ((1+i)^n - 1) / i`
  - 월복리 세전이자 = `만기금액 - P * n`
  - 세금 = `floor(세전이자 * 0.154)`
  - 세후이자 = `세전이자 - 세금`
  - 만기수령액 = `원금 + 세후이자`
- §7.4 자유적립식은 MVP에서 매월 정액 납입으로 가정하므로 별도 분기 없이 7.1/7.2를 적용한다.
- #3에서 테스트 러너가 이미 배선되어 있다: `package.json`의 `"test": "node --import tsx --test lib/**/*.test.ts"`. #4에서는 `package.json`을 수정하지 않는다.
- `lib/my-rate.test.ts`의 `node:test`, `node:assert/strict`, 상대경로 import 스타일을 따른다.
- 입력 도메인은 `lib/calc-input.ts`의 `TERM_OPTIONS = [6, 12, 24, 36]`, 월 납입액 `10000~1000000` 범위를 정상 입력으로 가정한다.
- `r`은 이미 소수인 연이율로 받는다. #3의 `myRateBp`를 `r = myRateBp / 10000`으로 바꾸는 일은 #5 호출부 책임이다.

## Constraints

- `lib/interest.ts`는 React/Next 의존이 없는 순수 모듈이다. `'use client'`를 쓰지 않는다.
- import는 이자유형 타입 재사용을 위한 `lib/types.ts` 타입 import만 둔다.
- 이자유형 타입은 `RateOption['intrRateType']`를 재사용한다. 새 `'S' | 'M'` 유니온을 만들지 않는다.
- 함수 시그니처는 `calculateInterest(params: InterestParams): InterestResult`이다.
- 결과 필드명은 `{ principal, pretaxInterest, tax, afterTaxInterest, maturityAmount }`이고 모두 `number` 원 단위 정수다.
- `Math.round`는 세전이자 계산 결과에만 1회 적용한다. 월별 이자나 중간 복리항은 원 단위 반올림하지 않는다.
- 세금, 세후이자, 만기수령액은 반올림된 세전이자 정수에서 파생한다.
- `tax = Math.floor(pretaxInterest * 0.154)`이며 세율은 `const TAX_RATE = 0.154` 단일 상수다.
- `annualRate === 0`으로 `i === 0`이면 월복리 식의 0 나눗셈을 피하기 위해 즉시 이자/세금 0 결과를 반환한다.
- `months <= 0` 또는 `monthlyDeposit <= 0`이면 이자/세금 0을 반환하되 `principal = monthlyDeposit * months`는 유지한다.
- `rsrvType`은 이 모듈의 입력이 아니다.
- `lib/types.ts`, `data/products.json`, `package.json`, `tsconfig.json`은 수정하지 않는다.
- 새 런타임/개발 의존성을 추가하지 않는다.
- 네트워크 호출과 서버 로깅을 추가하지 않는다.

## Files

### Read

- `REALRATE_기능명세서.md`
- `docs/github-issues/04-interest-engine.md`
- `lib/my-rate.ts`
- `lib/my-rate.test.ts`
- `lib/types.ts`
- `lib/calc-input.ts`
- `package.json`
- `docs/records/handoffs/issue-3-plan.md`
- `docs/records/2026-09-06-my-rate-calculation-verification.md`
- `docs/conventions/commit-message.md`

### Add

- `lib/interest.ts`
- `lib/interest.test.ts`
- `docs/records/2026-09-06-interest-engine-verification.md`

### Do Not Modify

- `package.json`
- `tsconfig.json`
- `lib/types.ts`
- `data/products.json`
- `app/**`
- `scripts/**`

## Acceptance Criteria

- `lib/interest.ts`가 React/Next를 import하지 않는 순수 모듈이고 `node --import tsx --test`로 직접 호출된다.
- `P=100000`, `n=12`, `r=0.03`, 단리의 `pretaxInterest`는 `19500`이다.
- `P=100000`, `n=1`, `r=0.12`, 단리의 `pretaxInterest`는 `1000`이다.
- 동일 `(P, n, r)`에서 월복리 `pretaxInterest`는 단리 이상이다.
- `r === 0`이면 단리와 월복리 모두 `pretaxInterest`, `tax`, `afterTaxInterest`가 0이고 `maturityAmount === principal`이다.
- 모든 케이스에서 `tax === Math.floor(pretaxInterest * 0.154)`이다.
- `afterTaxInterest === pretaxInterest - tax`, `principal === P * n`, `maturityAmount === principal + afterTaxInterest`이다.
- 결과 5개 필드는 모두 정수다.
- `lib/interest.ts`의 `Math.round` 호출은 세전이자 1곳에만 있다.
- 함수는 `rsrvType`을 받지 않는다.
- 금지 파일과 UI는 수정하지 않는다.
- `npm test`, `npm run typecheck`, `npm run build`가 통과한다.

## Verification

- `npm test` 출력에서 `lib/interest.test.ts`와 기존 `lib/my-rate.test.ts`가 모두 통과하는지 확인한다.
- `npm run typecheck`로 `lib/interest.ts`와 `lib/interest.test.ts` 포함 타입체크를 통과시킨다.
- T1~T4의 실제 반환값과 T1/T2 raw 세전이자 값을 기록한다.
- T3은 차이가 분명한 입력과 경계 입력을 함께 확인한다.
- 세금/파생값 불변식과 정수성을 매트릭스로 전수 확인한다.
- `r` 목록 `0.01`, `0.03`, `0.045`, `0.12`와 `n` 목록 `6`, `12`, `24`, `36`, `P` 목록 `10000`, `500000`, `1000000`을 테스트한다.
- `npm run build`에서 `check:reviewed` 다음 `next build`가 통과하는지 확인한다.
- `git diff --stat`으로 변경 범위가 `lib/interest.ts`, `lib/interest.test.ts`, 기록 문서뿐인지 확인한다.
- 기록 문서에 실행한 검증과 결과, T1 반올림 전/후 값, T3 조합, 달라진 설계 결정, `months <= 0` 가드, #5의 `myRateBp -> r` 변환 주의점을 남긴다.
