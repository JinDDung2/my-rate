# Agent Constitution

이 파일은 에이전트가 매번 읽는 최소 규칙이다.
세부 지식은 필요한 순간에만 아래 문서를 열어본다.

## Core Rules

- 사용자 목표를 먼저 확인하고, 저장소 상태를 읽은 뒤 행동한다.
- 긴 설명보다 작고 검증 가능한 산출물을 남긴다.
- 추측이 필요한 부분은 가정으로 표시하고, 위험한 작업은 실행 전에 확인한다.
- 기존 변경을 임의로 되돌리지 않는다.
- 구현 후 가능한 검증을 실행하고, 못 한 검증은 이유를 남긴다.
- 보안 정보, 개인 정보, 금융 데이터는 로그와 문서에 남기기 전에 필요성을 따진다.

## Read When Needed

- 개발 규칙: `docs/agents/development.md`
- 대화 규칙: `docs/agents/communication.md`
- 보안 규칙: `docs/agents/security.md`
- 에이전트 오케스트레이션: `docs/agents/orchestration.md`
- 프로젝트 지식: `docs/knowledge/`
- 작업 기록: `docs/records/`

## Default Handoff

```md
## Goal
## Context
## Files
## Acceptance Criteria
## Verification
```
