# F-10 제거 리뷰 수정

## Summary

리뷰에서 지적된 active 개발플랜 문서의 삭제 대상 참조를 정리했다. `REALRATE_개발플랜_AI프롬프트.md`에 남아 있던 자연어 상황 입력 구현 프롬프트와 삭제된 서버 라우트 경로를 제거하고, 해당 기능은 런타임 LLM 비용과 실패 지점 때문에 제거한다는 결정으로 갱신했다.

## Changes

- `REALRATE_개발플랜_AI프롬프트.md`의 자연어 상황 입력 추가 프롬프트를 제거 결정 문구로 교체했다.
- `docs/records/` 밖에서 `parse-situation`, `SituationInput`, `situation-input`, `rate-limit` 참조가 남지 않도록 정리했다.
- F-11 공유/해설과 배치 추출 중심 서사는 유지했다.

## Verification

- `npm test`: 66개 테스트 통과
- `npm run typecheck`: 통과
- `npm run build`: 통과
  - 최초 샌드박스 실행은 `tsx` IPC 파이프 `listen EPERM`으로 실패
  - 외부 권한 재실행에서 `check:reviewed` 43건 확인 및 Next.js 빌드 통과
- `rg -n "parse-situation|SituationInput|situation-input|rate-limit" --glob '!docs/records/**'`: 결과 없음
