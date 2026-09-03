# Agent Orchestration

여러 AI 에이전트를 함께 쓰기 위한 운영 설계다.
최소 규칙은 루트 `CLAUDE.md`에 있고, 이 문서는 역할과 핸드오프만 다룬다.

## Topology

- `CLAUDE.md`: 모든 에이전트가 공유하는 헌법
- `.claude/commands/*`: Claude에서 실행하는 작업 명령
- `AGENTS.md`: Codex가 읽는 진입점
- `docs/agents/orchestration.md`: 에이전트 간 역할과 핸드오프
- `docs/knowledge/`: 프로젝트 지식
- `docs/records/`: 작업 기록

## Default Flow

1. 사용자가 목표를 제시한다.
2. Claude가 제품 의도, 제약, 완료 조건을 정리한다.
3. Codex가 저장소 상태를 확인하고 구현한다.
4. Codex가 테스트 또는 빌드로 검증한다.
5. Claude 또는 사용자가 결과를 리뷰하고 다음 작업을 정한다.

## Work Types

### Discovery

- 입력: 사용자 아이디어, 문제 설명, 경쟁 서비스, 정책 자료
- 담당: Claude
- 출력: 요구사항, 범위, 질문, 리스크
- 완료 기준: 구현자가 시작할 수 있을 만큼 완료 조건이 명확하다.

### Design

- 입력: Discovery 산출물, 기존 코드 구조
- 담당: Claude 주도, Codex 보조
- 출력: 데이터 모델, 화면 흐름, API 초안, 테스트 전략
- 완료 기준: 변경 파일과 검증 방법이 예상 가능하다.

### Implementation

- 입력: Design 산출물 또는 직접 구현 요청
- 담당: Codex
- 출력: 코드, 테스트, 마이그레이션, 문서 갱신
- 완료 기준: 가능한 자동 검증이 통과하고 변경 요약이 남는다.

### Review

- 입력: 변경 diff, 테스트 결과, 남은 질문
- 담당: Claude 또는 Codex
- 출력: 버그, 회귀 위험, 누락 테스트, 개선 제안
- 완료 기준: 반드시 수정할 항목과 선택 개선 항목이 구분된다.

## Handoff Format

에이전트 간 작업을 넘길 때는 아래 형식을 사용한다.

```md
## Goal

## Context

## Constraints

## Files To Inspect

## Acceptance Criteria

## Verification
```

## Initial Agent Roster

| Agent | Primary Role | Reads | Writes |
| --- | --- | --- | --- |
| Claude | 요구사항, 설계, 리뷰 | `CLAUDE.md`, `docs/agents/*` | `.claude/commands/*`, 설계 문서 |
| Codex | 구현, 테스트, 검증 | `AGENTS.md`, `CLAUDE.md`, 코드 | 코드, 테스트, 문서 |

## Notes

- 에이전트별 파일에는 중복 규칙을 늘리지 않는다.
- 반복적으로 쓰는 지식은 `docs/knowledge/`로 옮긴다.
- 작업 결정과 검증 결과는 필요할 때 `docs/records/`에 남긴다.
