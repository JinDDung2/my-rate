import type { CalcInput, CheckableConditionCode } from '@/lib/calc-input';
import { CONDITION_META } from '@/lib/conditions';
import { calculateInterest } from '@/lib/interest';
import { calculateMyRate } from '@/lib/my-rate';
import { CONDITION_CODES, type Product, type RateOption } from '@/lib/types';

const MAX_ACTIONS = 3;
const CONDITION_ORDER = new Map(CONDITION_CODES.map((code, index) => [code, index]));

export interface ActionListItem {
  code: CheckableConditionCode;
  label: string;
  rateBp: number;
  afterTaxInterestDelta: number;
}

function calculateAfterTaxInterest(product: Product, option: RateOption, input: CalcInput): number {
  const myRateResult = calculateMyRate(product, option, input.selectedConditions);

  return calculateInterest({
    monthlyDeposit: input.monthlyAmount,
    months: input.termMonths,
    annualRate: myRateResult.myRateBp / 10000,
    interestType: option.intrRateType,
  }).afterTaxInterest;
}

export function buildActionList(
  product: Product,
  option: RateOption,
  input: CalcInput,
): ActionListItem[] {
  const baselineMyRate = calculateMyRate(product, option, input.selectedConditions);
  const baselineAfterTaxInterest = calculateInterest({
    monthlyDeposit: input.monthlyAmount,
    months: input.termMonths,
    annualRate: baselineMyRate.myRateBp / 10000,
    interestType: option.intrRateType,
  }).afterTaxInterest;
  const codeToRateBp = new Map<CheckableConditionCode, number>();

  for (const condition of baselineMyRate.unapplied) {
    const code = condition.code as CheckableConditionCode;
    codeToRateBp.set(code, (codeToRateBp.get(code) ?? 0) + condition.rateBp);
  }

  return [...codeToRateBp.entries()]
    .map(([code, rateBp]) => {
      const afterTaxInterest = calculateAfterTaxInterest(product, option, {
        ...input,
        selectedConditions: [...input.selectedConditions, code],
      });

      return {
        code,
        label: CONDITION_META[code].label,
        rateBp,
        afterTaxInterestDelta: afterTaxInterest - baselineAfterTaxInterest,
      };
    })
    .filter((item) => item.afterTaxInterestDelta > 0)
    .sort((a, b) => {
      if (b.afterTaxInterestDelta !== a.afterTaxInterestDelta) {
        return b.afterTaxInterestDelta - a.afterTaxInterestDelta;
      }

      return (CONDITION_ORDER.get(a.code) ?? CONDITION_CODES.length) -
        (CONDITION_ORDER.get(b.code) ?? CONDITION_CODES.length);
    })
    .slice(0, MAX_ACTIONS);
}
