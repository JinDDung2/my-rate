// 서브프로세스 실행 공통 래퍼.
// claude/codex/git/gh 모두 CLI 서브프로세스로 호출하므로 (docs/records/2026-09-05-agent-orchestrator-worktree-isolation.md 결정)
// 실패를 조용히 삼키지 않도록 exit code와 stderr를 항상 확인한다.

import { spawnSync } from 'node:child_process';

export interface RunResult {
  stdout: string;
  stderr: string;
  status: number;
}

export function run(cmd: string, args: string[], opts: { cwd?: string } = {}): RunResult {
  const result = spawnSync(cmd, args, {
    cwd: opts.cwd,
    encoding: 'utf-8',
    maxBuffer: 1024 * 1024 * 64,
  });
  if (result.error) {
    throw new Error(`${cmd} 실행 자체가 실패했습니다: ${result.error.message}`);
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '', status: result.status ?? 1 };
}

/** 실패 시 stderr를 포함해 즉시 던진다 — 원인 파악 없이 다음 단계로 넘어가지 않기 위함. */
export function runOrThrow(cmd: string, args: string[], opts?: { cwd?: string }): string {
  const result = run(cmd, args, opts);
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} 실패 (exit ${result.status})\n${result.stderr}`);
  }
  return result.stdout;
}
