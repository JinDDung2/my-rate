## Findings

**1. (치명적 · AC 미충족) 실제 배포가 수행되지 않음 — 이슈 #13의 핵심 산출물 부재**
원 핸드오프 AC 11개 중 배포에 의존하는 5개가 이 diff로 충족되지 않는다.
- "프로젝트가 Vercel에 배포되고 URL이 기록된다" → `vercel.json`만 커밋, 배포 URL 없음
- "배포 URL에서 조건 토글 시 갱신(수동 확인/스크린샷)" → 미수행
- "공유 URL을 배포 환경에서 열었을 때 `광고 1위와 다릅니다` 배지 표시" → 로컬·단위테스트로만 확인, 배포 환경 미검증
- "F-10 자연어 입력 배포 환경 degrade 확인" → 로컬만
- "가용성: 9/7 11:00 이전 기동, 9/11 23:59까지 무중단 구성 확인·기록" → 미충족. 문서는 "core ranking is static/client-side"라는 정성적 근거만 제시

문서(`docs/records/2026-09-07-e2e-demo-readiness.md`)는 이를 "Vercel 자격증명 없음 → Blocked"로 **정직하게** 기록했고 Codex도 "지시대로 blocked 유지"라고 밝혔다. 그러나 이슈 #13의 정의는 "실제 배포된 URL(9/7 11:00 이전 기동)"이며, 오늘이 2026-09-06으로 마감이 임박했다. diff 자체의 결함은 아니나, 이 상태로 이슈 #13은 클로즈 불가.

**2. (경미) 데모 URL이 플레이스홀더**
`docs/records/2026-09-07-e2e-demo-readiness.md` Demo URLs 표의 `<production-origin>`은 배포 후에만 채워진다. AC "공유 URL을 배포 환경에서 열었을 때 배지 표시"는 검증 불가 상태로 남아 있다.

**3. (경미) DoD 표 번호가 기능명세서 §11 완료조건 번호와 어긋남**
문서 DoD 표가 §11에 없는 "고지"를 6번으로 삽입하고 "PDF↔화면 대조"를 7번으로 밀어, §11의 6개 완료조건과 1:1 번호 대응이 깨진다. 심사 시 교차 참조 혼동 소지.

## Questions

- "실제 Vercel 배포는 blocked/pending 유지"라는 지시의 출처와 범위는? 이슈 #13 마감 전 별도 세션에서 배포를 완료할 계획이 확정되어 있는가?
- Vercel 프로젝트에 `ANTHROPIC_API_KEY`를 설정할 것인가(F-10 정상 동작) 아니면 미설정으로 수동 폴백만 시연할 것인가? 데모 시나리오 확정에 필요.
- `next.config.ts`의 `agentRules: false`는 표준 Next 옵션이 아닌데 의도적인가? (diff 범위 밖이나 배포 빌드에서 경고/실패 가능성)

## Test Gaps

- 신규 테스트 `keeps the real-data demo difference when salary transfer is selected`는 우대조건 **1개**만 커버. 핸드오프가 요구한 "조건 1~2개 체크 시 1위가 갈리는 제2 케이스"의 2개-조건 변형은 미커버.
- primary 데모(`m=500000&t=12&r=S`, 조건 0개)의 공유 URL 문자열 → 파싱 → 랭킹 결과 → 배지까지 잇는 통합 테스트 없음. `share-url.test.ts`(직렬화)와 `ranking.test.ts:345`(실데이터 케이스)가 분리되어 있어 "이 URL을 열면 배지가 뜬다"를 한 번에 고정하는 테스트가 없다.
- `vercel.json`의 `installCommand`/`buildCommand`가 `package.json` 스크립트와 드리프트해도 잡히지 않음.
- `situation-input.tsx`의 F-10 폴백(503 → 에러 토스트 1회) 동작에 대한 컴포넌트 테스트 없음 — degrade 경로가 회귀 위험.
- 이 리뷰 환경(샌드박스)에서 `npm test` 재실행 불가로 82/82 통과는 문서 로그에 의존. 단, diff의 유일한 테스트 변경분 수치는 수기 검증 완료: 세후이자 98,982 = 500,000 × 0.036/12 × 78(=Σ1..12) − 15.4% 세율. myRate 3.6(10-01-30-031-0036: term12 S base 3.6, SALARY_TRANSFER 조건 없음), advertisedLeader 2.2/4.1(TD11330030000: base 2.2, max 4.1, SALARY_TRANSFER 조건 없음) 모두 실데이터와 일치.

## Summary

diff의 코드·테스트·문서 산출물 자체는 건전하다.
- `vercel.json` 유효(`package-lock.json` 존재 → `npm ci` 정상), `buildCommand`가 `check:reviewed` 가드를 포함.
- 신규 ranking 테스트의 모든 단언(myRate 3.6, advertisedLeader myRate 2.2 / maxRate 4.1, 세후이자 98,982, `differsFromAdvertised` 유지)을 실데이터로 독립 검증했고 정확하다. 2차 데모 케이스를 회귀 테스트로 고정한 것은 유효한 개선.
- 문서 대조 체크리스트의 코드 근거를 실제 소스와 대조한 결과 일치: 랭킹 6컬럼(순위·은행·상품명·광고금리·내금리·세후실수령), F-02 범위 10,000–1,000,000 / 스텝 10,000 / 기간 6·12·24·36, 체크박스 8종(OTHER 제외), F-09 임계값 5bp = 0.05%p, `excluded` 조건 카드 미렌더, "AI 해석" 배지 무조건 표시.
- 검증 기록형 AC(테스트 로그, `check:reviewed` 43건, evidence 재확인 `unreviewed 0 evidence-miss 0`, excluded 조건 F-08 판정·근거, 기획서/기능명세서 ↔ 화면 대조 및 분류)는 충족.

핵심 한계: 원 핸드오프 AC 11개 중 배포 의존 5개가 미충족이며, 이슈 #13의 정의인 "9/7 11:00 이전 무중단 라이브 URL"이 여전히 부재하다. 문서화·검증 작업은 승인 가능 수준이나, **별도로 실제 배포가 완료되어 문서의 URL·스크린샷·가용성 항목이 채워지기 전까지 이슈 #13은 클로즈 불가.**