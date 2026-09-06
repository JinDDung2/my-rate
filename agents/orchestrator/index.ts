// GitHub Issue 기반 Claude ↔ Codex 오케스트레이터.
// 근거: docs/agents/orchestration.md, docs/records/2026-09-05-agent-orchestrator-worktree-isolation.md
//
// 흐름:
//   GitHub Issue → Claude(기획, plan 모드) → Codex(구현, 격리 워크트리)
//   → [Claude(리뷰) ↔ Codex(수정)] 반복 → Claude(최종 확인) → PR 생성
//
// 역할은 코드로 고정한다: Claude는 항상 plan 권한 모드(파일 수정 불가),
// Codex는 항상 이슈 전용 워크트리 안에서만 실행한다.
//
// 실행: npx tsx agents/orchestrator/index.ts <issue-number>

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runClaudePlan, runCodexImplement } from './lib/agents.js';
import { commentOnIssue, createPullRequest, getIssue } from './lib/github.js';
import { buildImplementPrompt, buildPlanPrompt, buildReviewPrompt } from './lib/prompts.js';
import {
  branchNameForIssue,
  createWorktree,
  diffAgainstMain,
  hasCommits,
  pushBranch,
  removeWorktree,
  worktreePath,
} from './lib/worktree.js';

const MAX_REVIEW_ROUNDS = 2;
const HANDOFF_DIR = 'docs/records/handoffs';

/**
 * /review.md 규칙: 문제 없으면 "## Findings" 아래에 "없음"이라고 쓰게 했다.
 *
 * 첫 줄만 검사한다. 두 가지 오탐을 둘 다 겪었다:
 * - 부분 문자열 검사(포함 여부)는 "React key 충돌 없음" 같은 정상 서술에도 걸린다
 *   (이슈 #1, 실제 결함이 있었는데 통과로 오판).
 * - 전체 일치 검사("없음" 한 마디뿐이어야 통과)는 "없음." 뒤에 확인 근거를 덧붙인
 *   정상적인 클린 리뷰를 놓친다 (이슈 #6, 실제로는 깨끗한데 불필요한 재작업 라운드 유발).
 * 첫 줄이 "없음"으로 시작하는지만 보면 두 경우 모두 올바르게 판단된다 — 실제
 * 지적사항은 항상 "1. ...", "**1...**" 같은 항목으로 시작하지 "없음"으로 시작하지 않는다.
 */
function isReviewClean(review: string): boolean {
  const findingsSection = review.split(/##\s*Findings/i)[1] ?? '';
  const body = findingsSection.split(/##\s*(Questions|Test Gaps|Summary)/i)[0] ?? findingsSection;
  const firstLine = body.trim().split('\n')[0]?.trim() ?? '';
  return firstLine.length === 0 || /^없음[.。]?$/.test(firstLine);
}

async function main(): Promise<void> {
  const issueNumber = Number(process.argv[2]);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    console.error('사용법: npx tsx agents/orchestrator/index.ts <issue-number>');
    process.exit(1);
  }

  console.log(`[1/5] 이슈 #${issueNumber} 조회 중...`);
  const issue = getIssue(issueNumber);
  console.log(`  ${issue.title}`);

  console.log('[2/5] Claude 기획 중 (plan 모드 — 코드 수정 없음)...');
  const plan = runClaudePlan(buildPlanPrompt(issue), process.cwd());
  mkdirSync(HANDOFF_DIR, { recursive: true });
  const planPath = `${HANDOFF_DIR}/issue-${issueNumber}-plan.md`;
  writeFileSync(planPath, plan);
  commentOnIssue(issueNumber, planPath);
  console.log(`  기획안 저장: ${planPath} (이슈에도 코멘트 남김)`);

  const branch = branchNameForIssue(issueNumber, issue.title);
  console.log(`[3/5] 워크트리 생성: ${worktreePath(issueNumber)} (브랜치: ${branch})`);
  const worktreeDir = createWorktree(issueNumber, branch);

  console.log('  Codex 구현 중...');
  let implementSummary = runCodexImplement(buildImplementPrompt(plan), worktreeDir);
  if (!hasCommits(worktreeDir)) {
    throw new Error(`Codex가 커밋을 남기지 않았습니다. 워크트리를 직접 확인하세요: ${worktreeDir}`);
  }

  console.log(`[4/5] Claude 리뷰 ↔ Codex 수정 루프 (최대 ${MAX_REVIEW_ROUNDS}회)...`);
  let review = '';
  for (let round = 1; round <= MAX_REVIEW_ROUNDS; round += 1) {
    const diff = diffAgainstMain(worktreeDir);
    review = runClaudePlan(buildReviewPrompt(plan, diff, implementSummary), worktreeDir);
    const reviewPath = `${HANDOFF_DIR}/issue-${issueNumber}-review-${round}.md`;
    writeFileSync(reviewPath, review);
    console.log(`  리뷰 라운드 ${round} 저장: ${reviewPath}`);

    if (isReviewClean(review)) {
      console.log('  리뷰 통과 — 반드시 수정할 항목 없음');
      break;
    }
    if (round === MAX_REVIEW_ROUNDS) {
      console.warn(`  최대 리뷰 라운드(${MAX_REVIEW_ROUNDS}) 도달 — 남은 지적사항이 있는 채로 진행합니다.`);
      break;
    }
    console.log('  리뷰 지적사항 반영을 위해 Codex 재실행...');
    implementSummary = runCodexImplement(buildImplementPrompt(plan, review), worktreeDir);
  }

  console.log('[5/5] PR 생성...');
  pushBranch(worktreeDir, branch);
  const prUrl = createPullRequest({
    base: 'main',
    head: branch,
    title: issue.title,
    body: `Closes #${issueNumber}\n\n${implementSummary}\n\n---\n\n${review}`,
  });
  console.log(`  PR 생성됨: ${prUrl}`);

  removeWorktree(issueNumber);
  console.log('워크트리 정리 완료.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
