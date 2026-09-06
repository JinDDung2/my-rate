## Findings

1. **`REALRATE_기획서.md` §5.4 「(선택) 런타임 AI — 자연어 상황 입력」이 그대로 남아 있다.** (심각도: 낮음, 문서 한정) 이 diff는 원래 핸드오프 범위 밖인 `REALRATE_개발플랜_AI프롬프트.md`까지 손봐서 "제거됨"으로 정리했는데, 정작 기획서 5.4절은 이 기능을 살아 있는 선택 기능으로 계속 소개한다(제거 표기·사유 없음). AC #6은 `REALRATE_기능명세서.md`만 명시하므로 AC 위반은 아니지만, F-10 전면 제거 작업의 문서 일관성 관점에서 누락이다. 같은 파일 93번 줄("런타임에는 LLM 호출이 없으므로 … 실패가 구조적으로 0")과도 내적으로 어긋난다.

   그 외 8개 AC 항목은 정적 검사로 모두 충족 확인:
   - `app/api/parse-situation/` 디렉터리 없음, `lib/parse-situation.ts(.test.ts)`·`lib/rate-limit.ts(.test.ts)`·`app/_components/situation-input.tsx` 삭제 확인.
   - `condition-panel.tsx`/`calculator.tsx`/`use-calc-input.ts` 배선 제거 후 dangling import·prop 없음. 체크박스 8종·월 납입액·기간·적립방식 입력 경로 무변경.
   - 저장소 전체(`docs/records/` 제외) `parse-situation`/`SituationInput`/`situation-input`/`rate-limit`/`RateLimiter` 참조 0건. `docs/github-issues/10-*.md` 삭제 + `create-issues.sh` 대응 라인 제거까지 반영됨.
   - `REALRATE_기능명세서.md` F-10 항목·§8.3·화면 구성도·API 표 행이 `(선택, 제거됨)` + 사유로 정리됨.
   - 금지 파일(`data/products.json`, `lib/interest.ts`, `lib/ranking.ts`, `lib/my-rate.ts`, `lib/calc-input.ts`, `scripts/extract-conditions.ts`, `package.json`) `git diff main...HEAD` 무변경 확인.

## Questions

1. `REALRATE_기획서.md` §5.4를 그대로 둔 것은 의도된 범위 제한인가, 누락인가? 개발플랜 문서를 정리한 것과 같은 기준이면 기획서도 `(제거됨)` 표기가 맞다.
2. `docs/github-issues/10-natural-language-situation.md`는 통째로 삭제했는데, `REALRATE_기능명세서.md`는 "삭제 말고 표기"였다. 이슈 파일은 삭제, 명세서는 표기 — 이 비대칭이 의도된 것인지 확인 바란다(삭제 자체는 타당해 보임).
3. `npm test` / `npm run typecheck` / `npm run build`를 이 리뷰 환경에서 직접 실행하지 못했다(node/npm/tsc 실행 차단). Codex가 보고한 "66개 통과 / typecheck 통과 / build 통과(샌드박스 `tsx listen EPERM` 후 재실행 통과)"에 의존한다. 66개 수치는 삭제 테스트(12 + 4 = 16)를 제외한 계산과 일치함을 정적으로 확인했다.

## Test Gaps

1. `lib/calc-input.ts`의 `applyConditions()`는 존치됐지만 이제 **호출처 0 + 테스트 0**이다(유일한 테스트가 삭제된 `parse-situation.test.ts`에 있었음). 핸드오프가 존치를 명시적으로 허용했으므로 이번 작업의 결함은 아니나, 검증 없이 남은 죽은 코드다. 후속 이슈로 제거하거나 최소한의 단위 테스트를 붙이는 편이 낫다.
2. `condition-panel.tsx`에 컴포넌트 렌더 테스트가 없어 "자연어 입력 UI 미노출"은 수동 확인에만 의존한다(기존 테스트 관행상 신규 갭은 아님).

## Summary

핸드오프의 Acceptance Criteria 8개 항목은 정적 검사 기준으로 모두 충족한다. 삭제·배선 정리·grep 청결·금지 파일 무변경·명세서 표기 전부 확인됐고, dangling import는 없다. 유일한 실질 지적은 낮은 심각도의 문서 불일치 하나 — `REALRATE_기획서.md` §5.4가 제거된 F-10을 여전히 살아 있는 선택 기능으로 서술한다. 이는 AC가 명시한 파일이 아니지만, 이 PR이 이미 원래 범위(개발플랜 문서)를 넘어 정리한 것과 형평이 맞지 않는다. 그 외에는 `applyConditions()`가 테스트·호출처 없이 남은 점을 후속 정리 대상으로 본다. 빌드/테스트/타입체크는 이 환경에서 직접 재현하지 못해 Codex 보고에 의존한다.