// .claude/commands/*.md 와 docs/agents/orchestration.md에 이미 정의된 핸드오프 형식을
// 그대로 재사용한다 — 오케스트레이터가 사람이 수동으로 하던 절차와 다른 형식을
// 새로 만들지 않기 위함.

import type { Issue } from './github.js';

const HANDOFF_FORMAT = `## Goal

## Context

## Constraints

## Files To Inspect

## Acceptance Criteria

## Verification`;

const REVIEW_FORMAT = `## Findings

## Questions

## Test Gaps

## Summary`;

/** Claude 기획 단계: 이슈 → Codex에게 넘길 핸드오프 문서. 코드 수정은 금지한다. */
export function buildPlanPrompt(issue: Issue): string {
  return `CLAUDE.md와 docs/agents/orchestration.md를 먼저 읽어라.
너는 이 프로젝트의 PM 겸 Architect다. 아래 GitHub 이슈를 분석해서 Codex(구현 담당)에게
넘길 핸드오프 문서를 작성해라. 너는 코드를 수정하지 않는다 — 분석과 설계만 한다.

## 이슈 #${issue.number}: ${issue.title}

${issue.body}

## 출력 형식

아래 형식 그대로만 출력해라. 다른 설명은 덧붙이지 마라.

${HANDOFF_FORMAT}`;
}

/** Codex 구현 단계. reviewFeedback이 있으면 수정 라운드다. */
export function buildImplementPrompt(handoff: string, reviewFeedback?: string): string {
  if (!reviewFeedback) {
    return `AGENTS.md와 CLAUDE.md를 먼저 읽어라. 아래 핸드오프 문서대로 구현, 테스트, 커밋까지 완료해라.
커밋 메시지는 docs/conventions/commit-message.md의 Conventional Commits 형식을 따른다.
작업이 끝나면 무엇을 구현했는지, 어떤 검증을 돌렸고 결과가 어땠는지 요약해라.

${handoff}`;
  }
  return `AGENTS.md와 CLAUDE.md를 먼저 읽어라. 이전 구현에 대한 리뷰 지적사항이다.
"반드시 수정" 항목을 반영하고 다시 테스트한 뒤 커밋해라.

## 리뷰 결과

${reviewFeedback}

## 원래 핸드오프 문서

${handoff}`;
}

/** Claude 리뷰 단계. 코드 수정은 금지하고 리뷰만 한다. */
export function buildReviewPrompt(handoff: string, diff: string, implementSummary: string): string {
  return `CLAUDE.md를 먼저 읽어라. 너는 시니어 리뷰어다. 아래 diff를 원래 핸드오프 문서의
Acceptance Criteria 기준으로 리뷰해라. 너는 코드를 수정하지 않는다 — 리뷰만 한다.
문제가 없으면 "## Findings" 아래에 "없음"이라고 명확히 써라. 애매하게 얼버무리지 마라.

## 원래 핸드오프 문서

${handoff}

## Codex 구현 요약

${implementSummary}

## Diff

\`\`\`diff
${diff}
\`\`\`

## 출력 형식

아래 형식 그대로만 출력해라. 다른 설명은 덧붙이지 마라.

${REVIEW_FORMAT}`;
}
