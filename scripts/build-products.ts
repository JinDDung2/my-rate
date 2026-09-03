// data/raw/savings.json + data/raw/extracted.json → data/products.json
// 근거: REALRATE_기능명세서.md §8.2 (검증 규칙을 코드로 강제), §6 데이터 모델
//
// 이 스크립트가 "검증 규칙"의 실체다: evidence 부분문자열 검증, 우대갭 초과 시
// low confidence 처리, unexplainedBp 계산을 실제로 실행해 data/products.json을 만든다.
// reviewed는 항상 false로 시작하며, 사람이 결과를 눈으로 검수한 뒤에만 true로 바뀐다.
//
// 실행: npx tsx scripts/build-products.ts

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { buildProduct } from './lib/pipeline.js';
import type { Product, RateOption, RawExtraction } from './lib/types.js';

const RAW_PATH = 'data/raw/savings.json';
const EXTRACTED_PATH = 'data/raw/extracted.json';
const OUT_PATH = 'data/products.json';

async function main() {
  const raw = JSON.parse(await readFile(RAW_PATH, 'utf-8')) as { baseList: any[]; optionList: any[] };
  const extracted = JSON.parse(await readFile(EXTRACTED_PATH, 'utf-8')) as RawExtraction[];

  const activeBase = raw.baseList.filter((b) => !b.dcls_end_day);

  const optionsByKey = new Map<string, any[]>();
  for (const o of raw.optionList) {
    const key = `${o.fin_co_no}::${o.fin_prdt_cd}`;
    const list = optionsByKey.get(key) ?? [];
    list.push(o);
    optionsByKey.set(key, list);
  }

  const extractionByKey = new Map<string, RawExtraction>();
  for (const e of extracted) {
    extractionByKey.set(`${e.finCoNo}::${e.finPrdtCd}`, e);
  }

  const products: Product[] = [];
  const manualReviewQueue: string[] = [];
  const disclosureMonths = new Set<string>();
  let discardedTotal = 0;

  for (const b of activeBase) {
    const key = `${b.fin_co_no}::${b.fin_prdt_cd}`;
    const rawOptions = optionsByKey.get(key) ?? [];
    if (rawOptions.length === 0) continue;

    const extraction = extractionByKey.get(key);
    if (!extraction) {
      console.warn(`추출 결과 없음, 건너뜀: ${b.fin_prdt_nm} (${key})`);
      continue;
    }
    if (extraction.failed) {
      manualReviewQueue.push(`${b.fin_prdt_nm} (${key}): 추출 자체 실패 — ${extraction.failureReason}`);
    }

    const options: RateOption[] = rawOptions.map((o) => ({
      saveTrm: Number(o.save_trm),
      intrRateType: o.intr_rate_type,
      rsrvType: o.rsrv_type,
      baseRate: o.intr_rate,
      maxRate: o.intr_rate2,
    }));

    const { product, needsManualReview, discardedEvidence, gapBp, sumRateBp } = buildProduct({
      finPrdtCd: b.fin_prdt_cd,
      companyName: b.kor_co_nm,
      productName: b.fin_prdt_nm,
      joinWay: b.join_way ?? '',
      rawSpecialCondition: b.spcl_cnd ?? '',
      options,
      disclosureMonth: b.dcls_month,
      extractedConditions: extraction.conditions,
    });

    disclosureMonths.add(b.dcls_month);
    discardedTotal += discardedEvidence.length;

    if (needsManualReview) {
      manualReviewQueue.push(
        `${b.fin_prdt_nm} (${key}): Σ rateBp(${sumRateBp}bp) > 우대갭(${gapBp}bp) — 전 조건 low confidence 처리됨`,
      );
    }
    for (const d of discardedEvidence) {
      console.warn(`  ⚠ evidence 폐기 [${b.fin_prdt_nm}] "${d.condition.evidence}" — ${d.reason}`);
    }

    products.push(product);
  }

  if (disclosureMonths.size > 1) {
    console.warn(`⚠ 데이터 기준월이 여러 개 섞여 있습니다: ${[...disclosureMonths].join(', ')}`);
  }
  const disclosureMonth = [...disclosureMonths][0] ?? '';

  const output = { disclosureMonth, products };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`저장 완료: ${OUT_PATH} (${products.length}건, 기준월 ${disclosureMonth})`);
  console.log(`evidence 폐기 총 ${discardedTotal}건`);
  if (manualReviewQueue.length > 0) {
    console.log(`\n수동 검수 필요 (${manualReviewQueue.length}건):`);
    for (const m of manualReviewQueue) console.log(`  - ${m}`);
  }
  console.log('\n※ 전 건 reviewed: false 상태입니다. 눈으로 검수 후 scripts/mark-reviewed.ts로 true 전환하세요.');
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
