Static review 완료. `npm test`/`typecheck`/`build`는 이 리뷰 환경의 샌드박스 승인 거부로 재실행하지 못했다(구현자 보고값 + 정적 확인에 의존).

## Findings

1. **AC 위반 — "저장소 전체 참조 없음"이 충족되지 않음.** `REALRATE_개발플랜_AI프롬프트.md`(frontmatter `status: active`)에 F-10 / `parse-situation` 참조가 그대로 남아 있다:
   - L266 `app/api/parse-situation/route.ts : POST { text } → ...`
   - L242 `여유 있으면 F-10 자연어 입력...`, L261 `### AI 프롬프트 (선택 기능 F-10)` 블록 전체(L261~276), L353 `F-10 자연어 상황 입력 — 선택 → 필수`, L372
   
   AC는 "저장소 전체에 `parse-situation` 참조가 남아있지 않다(`docs/records/` 제외)"이며 이 파일은 `docs/records/` 밖이고 `status: active`다. 원 핸드오프 "Files To Inspect"가 이 파일을 누락했고, Verification의 grep도 `app lib scripts`로만 좁혀서 구현자가 발견할 수 없었다. `REALRATE_기능명세서.md`와 동일하게 '(선택, 제거됨)' 주석 처리하거나, 최소한 L266의 삭제된 라우트 경로 참조는 정리해야 AC가 충족된다. (심각도: 낮음 — 런타임/빌드 영향 없음, 문서 일관성 문제)

2. **스코프 밖 변경(경미, 정당함).** `docs/github-issues/10-natural-language-situation.md` 삭제와 `scripts/github/create-issues.sh` 수정은 핸드오프 "Files To Inspect"에 없었다. Goal의 "그 전용 문서 항목 제거" 취지에는 부합하나 명시 승인 범위 밖이었음을 기록해 둔다. 되돌릴 필요는 없다.

그 외 AC는 충족:
- `app/api/parse-situation/` 디렉터리·라우트, `lib/parse-situation*`, `lib/rate-limit*`, `app/_components/situation-input.tsx` 모두 삭제 확인.
- `condition-panel.tsx` / `calculator.tsx` / `use-calc-input.ts` 배선 정리 정상 — 남은 prop(`onConditionToggle` 등)·체크박스 8종·월 납입액·기간·적립방식·`ShareButton` 유지.
- `git diff HEAD~1` 결과 `data/products.json`, `lib/interest.ts`, `lib/ranking.ts`, `lib/my-rate.ts`, `lib/calc-input.ts`, `package.json`, `scripts/extract-conditions.ts` 무변경 확인. `@anthropic-ai/sdk`(`^0.123.0`) 및 `extract:conditions` 스크립트 유지.
- `lib/calc-input.ts`의 `applyConditions`는 제약대로 존치.
- `REALRATE_기능명세서.md` F-10(L137), 8.3 런타임(L247), 화면 구성도, API 명세 표에서 제거 결정·이유 반영 확인, 잔여 F-10 참조 없음.
- `scripts` 및 소스 트리 grep에서 `parse-situation` / `SituationInput` / (신규)`rate-limit` 참조 없음(`REALRATE_개발플랜_AI프롬프트.md` 제외 — Finding 1).

## Questions

1. `REALRATE_개발플랜_AI프롬프트.md`는 `status: active`인데 6일 해커톤 회고성 문서다. 이 파일을 사실상 기록물로 간주해 AC의 "저장소 전체" 대상에서 제외할 것인가, 아니면 F-10 섹션을 '(제거됨)'으로 갱신할 것인가? (리뷰어 판단: 최소한 L266의 삭제된 파일 경로는 갱신 권장)
2. `docs/github-issues/10-natural-language-situation.md` 삭제 후 GitHub 상 이슈 #10은 어떻게 처리하는가(수동 close 예정인지)? create-issues.sh는 부트스트랩용이라 기존 이슈에는 영향 없음.

## Test Gaps

1. **`lib/calc-input.ts`의 `applyConditions`가 이제 완전 고아 상태.** 프로덕션 호출부 0곳(`use-calc-input.ts`에서 제거), 유일한 직접 테스트였던 `parse-situation.test.ts`의 "calc input condition union" 케이스도 삭제됨. 제약에 따라 함수는 존치하지만, 미사용 + 미검증 데드코드다. 후속 이슈로 제거하거나 `lib/calc-input.test.ts`에 최소 커버리지를 남기는 것을 권장.
2. `condition-panel.tsx` / `calculator.tsx`는 저장소에 RTL 미도입이라 컴포넌트 테스트가 없다. "체크박스 토글 → 랭킹/내 금리/액션 리스트 200ms 내 갱신, 자연어 UI 미노출"은 수동 확인에만 의존(핸드오프 Verification에 명시됨). 구현자 보고상 개발 서버에서 확인됨.
3. `npm test`(66개), `typecheck`, `build`를 이 환경에서 재실행하지 못했다. 구현자 보고는 전부 통과. 병합 전 CI 또는 재실행으로 최종 확인 필요.

## Summary

핵심 삭제·배선 정리·`REALRATE_기능명세서.md` 갱신은 핸드오프 의도대로 정확히 수행됐고, 변경 금지 파일과 `@anthropic-ai/sdk` 의존성은 무변경이다. 코드 레벨 회귀 위험은 낮다. 다만 `REALRATE_개발플랜_AI프롬프트.md`(status: active)에 삭제된 라우트 경로를 포함한 F-10 참조가 남아 있어 "저장소 전체 참조 없음" AC가 문자 그대로는 충족되지 않는다 — 이 문서를 기록물로 간주할지 결정하고, 아니라면 명세서와 동일하게 '(제거됨)' 처리해야 한다. 그 외 AC는 모두 충족. 병합 전 `npm test`/`typecheck`/`build` 재확인 권장.