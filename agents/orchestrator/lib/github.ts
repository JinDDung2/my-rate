// gh CLI 래퍼. 인증은 사용자의 `gh auth login` 세션을 그대로 쓴다.

import { runOrThrow } from './exec.js';

export interface Issue {
  number: number;
  title: string;
  body: string;
  url: string;
  labels: string[];
}

export function getIssue(number: number): Issue {
  const json = runOrThrow('gh', [
    'issue', 'view', String(number),
    '--json', 'number,title,body,url,labels',
  ]);
  const parsed = JSON.parse(json) as {
    number: number;
    title: string;
    body: string | null;
    url: string;
    labels: Array<{ name: string }>;
  };
  return {
    number: parsed.number,
    title: parsed.title,
    body: parsed.body ?? '',
    url: parsed.url,
    labels: parsed.labels.map((l) => l.name),
  };
}

export function commentOnIssue(number: number, bodyFilePath: string): void {
  runOrThrow('gh', ['issue', 'comment', String(number), '--body-file', bodyFilePath]);
}

export interface CreatePrOptions {
  base: string;
  head: string;
  title: string;
  body: string;
}

/** 생성된 PR의 URL을 반환한다. */
export function createPullRequest(opts: CreatePrOptions): string {
  return runOrThrow('gh', [
    'pr', 'create',
    '--base', opts.base,
    '--head', opts.head,
    '--title', opts.title,
    '--body', opts.body,
  ]).trim();
}
