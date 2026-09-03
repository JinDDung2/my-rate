// 우대조건 추출 결과에 대한 검증 규칙 (코드로 강제).
// 근거: REALRATE_기능명세서.md §8.2 출력 검증 규칙

import type { Product, RateOption, SpecialCondition } from './types.js';

/**
 * 상품의 옵션(만기별 금리) 중 우대갭(maxRate - baseRate)이 가장 큰 옵션을 고른다.
 * spcl_cnd 원문은 만기와 무관하게 하나이므로, 검증 기준 G는
 * "이 상품에서 관찰되는 최대 우대갭"을 사용한다 — 만기별 우대갭 차이로 인해
 * 정상 조건이 false positive로 low confidence 처리되는 것을 막기 위한 선택.
 * 동률이면 가입기간(saveTrm)이 긴 옵션을 우선한다.
 */
export function pickRepresentativeOption(options: RateOption[]): RateOption {
  if (options.length === 0) {
    throw new Error('옵션이 없는 상품은 대표 옵션을 계산할 수 없습니다.');
  }
  return options.reduce((best, cur) => {
    const bestGap = best.maxRate - best.baseRate;
    const curGap = cur.maxRate - cur.baseRate;
    if (curGap > bestGap + 1e-9) return cur;
    if (curGap < bestGap - 1e-9) return best;
    return cur.saveTrm > best.saveTrm ? cur : best;
  });
}

/** 퍼센트 포인트 차이를 basis point 정수로 변환 (부동소수점 오차 방지). */
export function gapToBp(baseRate: number, maxRate: number): number {
  return Math.round((maxRate - baseRate) * 100);
}

export function computeGapBp(options: RateOption[]): number {
  const rep = pickRepresentativeOption(options);
  return Math.max(0, gapToBp(rep.baseRate, rep.maxRate));
}

export interface EvidenceFilterResult {
  kept: SpecialCondition[];
  discarded: Array<{ condition: SpecialCondition; reason: string }>;
}

/**
 * 규칙 1: evidence가 rawSpecialCondition의 부분 문자열이 아니면 폐기 (환각 차단).
 * 공백류 문자를 정규화한 뒤 비교한다 — 모델이 줄바꿈/공백을 살짝 바꿔 인용하는
 * 경우까지 부분 문자열 검사에서 걸러지면 정상 추출까지 과도하게 버려지기 때문.
 */
export function filterValidEvidence(raw: string, conditions: SpecialCondition[]): EvidenceFilterResult {
  const normalize = (s: string) => s.replace(/\s+/g, '');
  const normalizedRaw = normalize(raw);

  const kept: SpecialCondition[] = [];
  const discarded: Array<{ condition: SpecialCondition; reason: string }> = [];

  for (const c of conditions) {
    if (!c.evidence || c.evidence.trim().length === 0) {
      discarded.push({ condition: c, reason: 'evidence가 비어 있음' });
      continue;
    }
    if (normalizedRaw.includes(normalize(c.evidence))) {
      kept.push(c);
    } else {
      discarded.push({ condition: c, reason: 'evidence가 원문의 부분 문자열이 아님 (환각 의심)' });
    }
  }

  return { kept, discarded };
}

/**
 * 규칙 2: Σ rateBp > G(bp) 이면 전부 confidence: 'low' 처리 후 수동 검수 큐로.
 * rateBp === 0인 조건도 합계 계산에는 포함한다 (표시/계산 제외는 별개 관심사).
 */
export function applyConfidenceRule(
  conditions: SpecialCondition[],
  gapBp: number,
): { conditions: SpecialCondition[]; needsManualReview: boolean; sumRateBp: number } {
  const sumRateBp = conditions.reduce((acc, c) => acc + c.rateBp, 0);
  const overGap = sumRateBp > gapBp;

  const result = overGap ? conditions.map((c) => ({ ...c, confidence: 'low' as const })) : conditions;

  return { conditions: result, needsManualReview: overGap, sumRateBp };
}

/** 규칙 4: unexplainedBp = max(0, G*100 - Σ rateBp). G는 이미 bp 단위로 전달받는다. */
export function computeUnexplainedBp(sumRateBp: number, gapBp: number): number {
  return Math.max(0, gapBp - sumRateBp);
}

export interface BuildProductInput {
  finPrdtCd: string;
  companyName: string;
  productName: string;
  joinWay: string;
  rawSpecialCondition: string;
  options: RateOption[];
  disclosureMonth: string;
  extractedConditions: SpecialCondition[];
}

export interface BuildProductResult {
  product: Product;
  needsManualReview: boolean;
  discardedEvidence: Array<{ condition: SpecialCondition; reason: string }>;
  gapBp: number;
  sumRateBp: number;
}

/**
 * 원시 추출 결과 + 원문 + 금리 옵션을 검증 규칙에 통과시켜 최종 Product를 만든다.
 * reviewed는 항상 false로 시작한다 — 사람 검수(§ DoD)를 거쳐야만 true가 된다.
 */
export function buildProduct(input: BuildProductInput): BuildProductResult {
  const gapBp = computeGapBp(input.options);

  const { kept, discarded } = filterValidEvidence(input.rawSpecialCondition, input.extractedConditions);
  const { conditions, needsManualReview, sumRateBp } = applyConfidenceRule(kept, gapBp);
  const unexplainedBp = computeUnexplainedBp(sumRateBp, gapBp);

  const product: Product = {
    finPrdtCd: input.finPrdtCd,
    companyName: input.companyName,
    productName: input.productName,
    joinWay: input.joinWay,
    rawSpecialCondition: input.rawSpecialCondition,
    conditions,
    options: input.options,
    disclosureMonth: input.disclosureMonth,
    unexplainedBp,
    reviewed: false,
  };

  return { product, needsManualReview, discardedEvidence: discarded, gapBp, sumRateBp };
}
