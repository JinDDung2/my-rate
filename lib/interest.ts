import type { RateOption } from './types';

const TAX_RATE = 0.154;

export interface InterestParams {
  monthlyDeposit: number;
  months: number;
  annualRate: number;
  interestType: RateOption['intrRateType'];
}

export interface InterestResult {
  principal: number;
  pretaxInterest: number;
  tax: number;
  afterTaxInterest: number;
  maturityAmount: number;
}

export function calculateInterest(params: InterestParams): InterestResult {
  const { monthlyDeposit, months, annualRate, interestType } = params;
  const principal = monthlyDeposit * months;
  const monthlyRate = annualRate / 12;

  if (monthlyDeposit <= 0 || months <= 0 || monthlyRate === 0) {
    return {
      principal,
      pretaxInterest: 0,
      tax: 0,
      afterTaxInterest: 0,
      maturityAmount: principal,
    };
  }

  const rawPretaxInterest =
    interestType === 'M'
      ? monthlyDeposit * (1 + monthlyRate) * (((1 + monthlyRate) ** months - 1) / monthlyRate) -
        principal
      : monthlyDeposit * monthlyRate * (months * (months + 1)) / 2;
  const pretaxInterest = Math.round(rawPretaxInterest);
  const tax = Math.floor(pretaxInterest * TAX_RATE);
  const afterTaxInterest = pretaxInterest - tax;

  return {
    principal,
    pretaxInterest,
    tax,
    afterTaxInterest,
    maturityAmount: principal + afterTaxInterest,
  };
}
