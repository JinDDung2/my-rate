// 배포 빌드 가드: 전 상품 검수 완료(reviewed: true) 전에는 빌드 실패.
// 근거: REALRATE_기능명세서.md §8.2 규칙 5, docs/github-issues/09-ai-extraction-pipeline.md AC
//
// 실행: npx tsx scripts/check-reviewed.ts  (0=통과, 1=실패)

import { readFile } from 'node:fs/promises';
import type { Product } from './lib/types.js';

const PRODUCTS_PATH = 'data/products.json';

async function main() {
  let data: { disclosureMonth: string; products: Product[] };
  try {
    data = JSON.parse(await readFile(PRODUCTS_PATH, 'utf-8'));
  } catch (err) {
    console.error(`${PRODUCTS_PATH}를 읽을 수 없습니다:`, err instanceof Error ? err.message : err);
    process.exit(1);
    return;
  }

  const unreviewed = data.products.filter((p) => !p.reviewed);
  if (unreviewed.length > 0) {
    console.error(`빌드 실패: 검수 미완료 상품 ${unreviewed.length}건`);
    for (const p of unreviewed) console.error(`  - ${p.companyName} ${p.productName} (${p.finPrdtCd})`);
    process.exit(1);
  }

  console.log(`검수 완료 확인: 전 ${data.products.length}건 reviewed: true`);
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
