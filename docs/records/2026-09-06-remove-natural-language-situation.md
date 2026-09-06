# F-10 자연어 상황 입력 제거

## Summary

F-10 자연어 상황 입력 기능을 제거했다. 런타임 LLM 호출 기반 UI/API는 제품의 배치 추출 중심 방향과 맞지 않아 제거하고, 체크박스 8종 수동 입력 경로는 유지한다.

## Changes

- `app/_components/situation-input.tsx`와 `/api/parse-situation` 라우트를 삭제했다.
- `lib/parse-situation.ts`와 전용 테스트, `lib/rate-limit.ts`와 전용 테스트를 삭제했다.
- `ConditionPanel`과 `Calculator`, `useCalcInput`에서 자연어 입력 전용 prop/export 배선을 제거했다.
- `REALRATE_기능명세서.md`에 F-10을 `(선택, 제거됨)`으로 표시하고 제거 사유를 남겼다.
- 신규 이슈 생성 스크립트에서 제거된 F-10 이슈 생성 항목을 제외했다.

## Verification

- `npm test`: 66개 테스트 통과
- `npm run typecheck`: 통과
- `npm run build`: 통과 (`check:reviewed` 43건 완료 확인 포함)
- `grep -rn "parse-situation\|SituationInput\|situation-input" app lib scripts`: 결과 없음
- 개발 서버 확인: `/` 200, `/api/products` 200, 제거된 파서 API 404
