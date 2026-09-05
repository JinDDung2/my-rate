// Claude/Codex CLI 서브프로세스 호출.
// 역할 고정 (docs/agents/orchestration.md): Claude = 기획/리뷰/최종 판단, Codex = 구현.
// 이 구분을 코드 레벨에서도 강제한다 — Claude 호출은 항상 plan 권한 모드라
// 파일을 쓸 수 없고, Codex만 워크트리 안에서 실제로 코드를 바꾼다.

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './exec.js';

/**
 * plan 권한 모드로 실행한다 — 읽기/분석만 가능하고 파일 수정 도구는 막힌다.
 * 기획과 리뷰 양쪽에 재사용한다.
 */
export function runClaudePlan(prompt: string, cwd: string): string {
  const result = run(
    'claude',
    ['-p', prompt, '--permission-mode', 'plan', '--output-format', 'json'],
    { cwd },
  );
  if (result.status !== 0) {
    throw new Error(`claude 실행 실패 (exit ${result.status})\n${result.stderr}`);
  }
  let parsed: { result?: string };
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error(`claude 출력이 JSON이 아닙니다:\n${result.stdout.slice(0, 500)}`);
  }
  if (!parsed.result) {
    throw new Error(`claude 응답에 result 필드가 없습니다:\n${result.stdout.slice(0, 500)}`);
  }
  return parsed.result;
}

/**
 * cwd는 반드시 격리된 워크트리 디렉터리여야 한다 (worktree.ts 참고).
 * --approve-for-me는 승인 요청을 자동 검토로 돌리면서 workspace-write 샌드박스를
 * 강제한다 (cwd 밖 파일 쓰기 차단) — codex CLI가 `--sandbox`와 동시 지정을 막는다.
 */
export function runCodexImplement(prompt: string, cwd: string): string {
  const outFile = join(mkdtempSync(join(tmpdir(), 'codex-out-')), 'last-message.txt');
  const result = run('codex', [
    'exec', prompt,
    '--cd', cwd,
    '--approve-for-me',
    '-o', outFile,
  ]);
  if (result.status !== 0) {
    throw new Error(`codex 실행 실패 (exit ${result.status})\n${result.stderr}`);
  }
  try {
    return readFileSync(outFile, 'utf-8');
  } catch {
    return result.stdout;
  }
}
