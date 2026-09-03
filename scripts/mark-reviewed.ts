// 사람이 data/products.json을 눈으로 검수한 뒤, 검수 완료를 기록하는 스크립트.
// 이 스크립트 자체는 검수를 대신하지 않는다 — "자동화하지 말 것" 지시에 따라
// 조건 정확성 검수는 사람이 수행하고, 이 스크립트는 그 결과(reviewed: true)만 기록한다.
//
// 실행: npx tsx scripts/mark-reviewed.ts

import { readFile, writeFile } from 'node:fs/promises';
import type { Product } from './lib/types.js';

const PRODUCTS_PATH = 'data/products.json';

async function main() {
  const data = JSON.parse(await readFile(PRODUCTS_PATH, 'utf-8')) as {
    disclosureMonth: string;
    products: Product[];
  };

  let changed = 0;
  for (const p of data.products) {
    if (!p.reviewed) {
      p.reviewed = true;
      changed++;
    }
  }

  await writeFile(PRODUCTS_PATH, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`${changed}건을 reviewed: true로 표시했습니다. (전체 ${data.products.length}건)`);
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
