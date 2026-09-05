# Claude/Codex 오케스트레이터 — 워크트리 격리 결정

## 배경

`agents/orchestrator/index.ts`로 다음 파이프라인을 자동화하기로 했다.

```text
GitHub Issue
  → Claude (기획: 요구사항/수용조건 정리)
  → Codex (구현/테스트/커밋)
  → Claude (리뷰) ↔ Codex (수정) 반복
  → Claude (최종 판단)
  → PR 생성
```

역할은 고정한다: **Claude = PM/Architect/Reviewer, Codex = Fullstack Developer**
(`docs/agents/orchestration.md`의 기존 역할 정의와 동일).

## 사고: agents/ 디렉터리 소실

설계 작업 중, 본 저장소 디렉터리(`my-rate/`)에서 `git checkout main` + `git stash -u`로
브랜치를 정리하다가 `agents/` 디렉터리 전체(미커밋 상태)가 사라졌다. 원인을 추적한 결과,
같은 디렉터리에서 **테스트 중이던 다른 `claude` CLI 프로세스가 동시에 실행되고 있었다**는
것을 확인했다 (`ps`로 동일 cwd를 가진 두 번째 `claude` 프로세스 발견). 정확한 실패 지점은
재현하지 못했지만, 두 프로세스가 같은 working tree를 동시에 건드리는 경쟁 상태로 추정된다.

다행히 삭제된 파일 중 마크다운 3개는 대화 세션에 이미 읽어둔 내용이 남아 있어 복구했고,
빈 파일 1개는 원래도 내용이 없어 손실이 없었다. 하지만 일반적으로는 이런 경쟁 상태가
복구 불가능한 손실로 이어질 수 있다.

## 결정

1. **Codex는 항상 이슈 전용 git worktree(`​.worktrees/issue-<n>`) 안에서만 실행한다.**
   본 저장소 루트(`my-rate/`)는 Claude(기획/리뷰) 전용으로 고정한다. 서로 다른 역할이
   같은 디렉터리를 동시에 쓰지 않게 해서 이번 사고의 재발 경로 자체를 없앤다.
2. **Claude 호출은 항상 `--permission-mode plan`.** 기획/리뷰 단계에서 Claude가 파일을
   수정할 수 없도록 코드 레벨에서 강제한다 — "코드는 Codex만 바꾼다"는 역할 분리를
   설정이 아니라 구조로 보장한다.
3. **Codex 호출은 `--sandbox workspace-write`로 cwd(워크트리) 밖 쓰기를 차단한다.**
   설정 실수로 본 저장소를 건드리는 경로를 추가로 막는다.
4. 워크트리는 PR 생성 후 `git worktree remove`로 정리하되, 브랜치는 origin에 push된
   상태이므로 워크트리 삭제가 작업 손실로 이어지지 않는다.
5. 리뷰 ↔ 수정 루프는 최대 2회로 제한한다 (무한 루프 방지). 2회 안에 정리되지 않으면
   사람이 개입해야 한다는 신호로 본다.

## 확인되지 않은 것 / 후속 검증 필요

- `claude -p --permission-mode plan`이 완전 비대화형 환경(TTY 없음)에서 권한 프롬프트 없이
  끝까지 실행되는지는 아직 실제 이슈로 smoke test하지 않았다. 낮은 리스크의 이슈 1건으로
  먼저 검증한 뒤 나머지에 적용한다.
- `/review.md` 출력에서 "없음" 문자열 매칭으로 리뷰 통과 여부를 판단하는 것은 휴리스틱이다
  (`isReviewClean`, `agents/orchestrator/index.ts`). Claude가 형식을 어기면 오탐할 수 있다.
