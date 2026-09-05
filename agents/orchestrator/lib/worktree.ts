// Codex 전용 작업 디렉터리 격리.
//
// 2026-09-05: 같은 디렉터리에서 Claude 세션과 오케스트레이터를 동시에 돌리다가
// agents/ 디렉터리가 통째로 사라지는 사고가 있었다. 원인은 두 프로세스가 같은
// working tree를 동시에 건드린 경쟁 상태로 추정된다.
// 재발 방지책: Codex는 항상 이슈 전용 git worktree 안에서만 실행하고, 본 저장소
// 루트는 Claude(기획/리뷰)만 사용한다. 자세한 내용은
// docs/records/2026-09-05-agent-orchestrator-worktree-isolation.md 참고.

import { existsSync } from 'node:fs';
import { run, runOrThrow } from './exec.js';

const WORKTREE_ROOT = '.worktrees';

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/\[.*?\]/g, '')
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug || 'work';
}

export function branchNameForIssue(issueNumber: number, title: string): string {
  return `feature/issue-${issueNumber}-${slugify(title)}`;
}

export function worktreePath(issueNumber: number): string {
  return `${WORKTREE_ROOT}/issue-${issueNumber}`;
}

/** origin/main 기준으로 새 브랜치 + 워크트리를 만든다. 이미 있으면 정리부터 요구한다. */
export function createWorktree(issueNumber: number, branch: string): string {
  const path = worktreePath(issueNumber);
  if (existsSync(path)) {
    throw new Error(
      `워크트리가 이미 존재합니다: ${path}. 이전 실행이 정리되지 않았을 수 있으니 ` +
        `\`git worktree remove ${path} --force\`로 직접 정리한 뒤 다시 실행하세요.`,
    );
  }
  runOrThrow('git', ['fetch', 'origin', 'main']);
  runOrThrow('git', ['worktree', 'add', path, '-b', branch, 'origin/main']);
  return path;
}

export function diffAgainstMain(worktreeDir: string): string {
  return runOrThrow('git', ['-C', worktreeDir, 'diff', 'origin/main...HEAD']);
}

export function hasCommits(worktreeDir: string): boolean {
  const result = run('git', ['-C', worktreeDir, 'rev-list', '--count', 'origin/main..HEAD']);
  return parseInt(result.stdout.trim() || '0', 10) > 0;
}

export function pushBranch(worktreeDir: string, branch: string): void {
  runOrThrow('git', ['-C', worktreeDir, 'push', '-u', 'origin', branch]);
}

/** PR 생성 후 호출한다. 브랜치 자체는 origin에 남아 있으므로 데이터 손실이 없다. */
export function removeWorktree(issueNumber: number): void {
  run('git', ['worktree', 'remove', worktreePath(issueNumber), '--force']);
}
