import type { ConditionStatusResolver } from '@/lib/bank-condition';
import type { CheckableConditionCode, ReserveType, TermMonths } from '@/lib/calc-input';
import type { Product, RateOption, SpecialCondition } from '@/lib/types';
import { CONDITION_CODES } from '@/lib/types';

export interface MyRateResult {
  myRate: number;
  myRateBp: number;
  baseRate: number;
  maxRate: number;
  appliedBp: number;
  clamped: boolean;
  clampedAwayBp: number;
  applied: SpecialCondition[];
  notMet: SpecialCondition[];
  unconfirmed: SpecialCondition[];
  excluded: SpecialCondition[];
}

const CONDITION_ORDER = new Map(CONDITION_CODES.map((code, index) => [code, index]));

export function toBp(rate: number): number {
  return Math.round(rate * 100);
}

export function isCountable(condition: SpecialCondition): boolean {
  return condition.code !== 'OTHER' && condition.rateBp !== 0;
}

export function findRateOption(
  product: Product,
  termMonths: TermMonths,
  reserveType: ReserveType,
): RateOption | null {
  return (
    product.options.find((option) => option.saveTrm === termMonths && option.rsrvType === reserveType) ?? null
  );
}

export function calculateMyRate(
  product: Product,
  option: RateOption,
  resolveStatus: ConditionStatusResolver,
): MyRateResult {
  const indexedConditions = product.conditions.map((condition, index) => ({ condition, index }));

  indexedConditions.sort((a, b) => {
    const conditionOrder =
      (CONDITION_ORDER.get(a.condition.code) ?? CONDITION_CODES.length) -
      (CONDITION_ORDER.get(b.condition.code) ?? CONDITION_CODES.length);
    if (conditionOrder !== 0) return conditionOrder;
    return a.index - b.index;
  });

  const applied: SpecialCondition[] = [];
  const notMet: SpecialCondition[] = [];
  const unconfirmed: SpecialCondition[] = [];
  const excluded: SpecialCondition[] = [];

  for (const { condition } of indexedConditions) {
    if (!isCountable(condition)) {
      excluded.push(condition);
    } else {
      const status = resolveStatus(condition.code as CheckableConditionCode);
      ({ applied, notMet, unconfirmed })[status].push(condition);
    }
  }

  const baseRateBp = toBp(option.baseRate);
  const maxRateBp = toBp(option.maxRate);
  const appliedBp = applied.reduce((sum, condition) => sum + condition.rateBp, 0);
  const unclampedRateBp = baseRateBp + appliedBp;
  const myRateBp = Math.max(baseRateBp, Math.min(unclampedRateBp, maxRateBp));

  return {
    myRate: myRateBp / 100,
    myRateBp,
    baseRate: option.baseRate,
    maxRate: option.maxRate,
    appliedBp,
    clamped: unclampedRateBp > maxRateBp,
    clampedAwayBp: Math.max(0, unclampedRateBp - myRateBp),
    applied,
    notMet,
    unconfirmed,
    excluded,
  };
}
