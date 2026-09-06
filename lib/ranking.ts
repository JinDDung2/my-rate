import type { CalcInput } from '@/lib/calc-input';
import { calculateInterest, type InterestResult } from '@/lib/interest';
import { calculateMyRate, findRateOption, type MyRateResult } from '@/lib/my-rate';
import type { Product, RateOption } from '@/lib/types';

export interface RankingRow {
  rank: number;
  finPrdtCd: string;
  companyName: string;
  productName: string;
  maxRate: number;
  myRate: number;
  afterTaxInterest: number;
  option: RateOption;
  myRateResult: MyRateResult;
  interest: InterestResult;
}

type UnrankedRow = Omit<RankingRow, 'rank'>;

function compareCodePointAscending(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function buildRanking(products: readonly Product[], input: CalcInput): RankingRow[] {
  const rows: UnrankedRow[] = products.flatMap((product) => {
    const option = findRateOption(product, input.termMonths, input.reserveType);
    if (!option) return [];

    const myRateResult = calculateMyRate(product, option, input.selectedConditions);
    const interest = calculateInterest({
      monthlyDeposit: input.monthlyAmount,
      months: input.termMonths,
      annualRate: myRateResult.myRateBp / 10000,
      interestType: option.intrRateType,
    });

    return [
      {
        finPrdtCd: product.finPrdtCd,
        companyName: product.companyName,
        productName: product.productName,
        maxRate: option.maxRate,
        myRate: myRateResult.myRate,
        afterTaxInterest: interest.afterTaxInterest,
        option,
        myRateResult,
        interest,
      },
    ];
  });

  rows.sort((a, b) => {
    if (b.afterTaxInterest !== a.afterTaxInterest) {
      return b.afterTaxInterest - a.afterTaxInterest;
    }

    if (b.option.baseRate !== a.option.baseRate) {
      return b.option.baseRate - a.option.baseRate;
    }

    return compareCodePointAscending(a.finPrdtCd, b.finPrdtCd);
  });

  return rows.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}
