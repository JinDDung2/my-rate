import { GLOBAL_CONDITION_CODES } from '@/lib/conditions';
import type { ConditionCode, RateOption } from '@/lib/types';

export type CheckableConditionCode = Exclude<ConditionCode, 'OTHER'>;
export type BankScopedConditionCode = 'SALARY_TRANSFER' | 'CARD_USAGE' | 'FIRST_CUSTOMER';
export type GlobalConditionCode = Exclude<CheckableConditionCode, BankScopedConditionCode>;
export type ReserveType = RateOption['rsrvType'];
export type TermMonths = (typeof TERM_OPTIONS)[number];

export interface CalcInput {
  monthlyAmount: number;
  termMonths: TermMonths;
  reserveType: ReserveType;
  selectedConditions: GlobalConditionCode[];
  salaryTransferBank: string | null;
  cardUsageBank: string | null;
  productConditionOverrides: Record<string, Partial<Record<BankScopedConditionCode, true>>>;
}

export const TERM_OPTIONS = [6, 12, 24, 36] as const;
export const MONTHLY_AMOUNT_MIN = 10_000;
export const MONTHLY_AMOUNT_MAX = 1_000_000;
export const MONTHLY_AMOUNT_STEP = 10_000;

export const RESERVE_TYPE_LABELS: Record<ReserveType, string> = {
  S: '정액적립',
  F: '자유적립',
};

export const DEFAULT_CALC_INPUT: CalcInput = {
  monthlyAmount: 500_000,
  termMonths: 12,
  reserveType: 'S',
  selectedConditions: [],
  salaryTransferBank: null,
  cardUsageBank: null,
  productConditionOverrides: {},
};

export type MonthlyAmountParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'not-a-number' | 'out-of-range' | 'not-a-step' };

export function parseMonthlyAmount(text: string): MonthlyAmountParseResult {
  const normalizedText = text.trim();

  if (normalizedText === '') {
    return { ok: false, reason: 'empty' };
  }

  if (!/^[\d,]+$/.test(normalizedText)) {
    return { ok: false, reason: 'not-a-number' };
  }

  const digits = normalizedText.replaceAll(',', '');
  if (digits === '') {
    return { ok: false, reason: 'not-a-number' };
  }

  const value = Number.parseInt(digits, 10);
  if (!Number.isSafeInteger(value)) {
    return { ok: false, reason: 'out-of-range' };
  }

  if (value < MONTHLY_AMOUNT_MIN || value > MONTHLY_AMOUNT_MAX) {
    return { ok: false, reason: 'out-of-range' };
  }

  if (value % MONTHLY_AMOUNT_STEP !== 0) {
    return { ok: false, reason: 'not-a-step' };
  }

  return { ok: true, value };
}

export function toggleCondition(
  codes: GlobalConditionCode[],
  code: GlobalConditionCode,
): GlobalConditionCode[] {
  const next = codes.includes(code)
    ? codes.filter((selectedCode) => selectedCode !== code)
    : [...codes, code];

  return GLOBAL_CONDITION_CODES.filter((conditionCode) => next.includes(conditionCode));
}

export function applyConditions(
  current: GlobalConditionCode[],
  incoming: readonly GlobalConditionCode[],
): GlobalConditionCode[] {
  const next = new Set<ConditionCode>(current);
  for (const code of incoming) {
    next.add(code);
  }

  return GLOBAL_CONDITION_CODES.filter((conditionCode) => next.has(conditionCode));
}

export function clampMonthlyAmount(value: number): number {
  return Math.min(MONTHLY_AMOUNT_MAX, Math.max(MONTHLY_AMOUNT_MIN, value));
}

export function snapMonthlyAmount(value: number): number {
  const clampedValue = clampMonthlyAmount(value);
  const snappedValue = Math.round(clampedValue / MONTHLY_AMOUNT_STEP) * MONTHLY_AMOUNT_STEP;

  return clampMonthlyAmount(snappedValue);
}

export function setSalaryTransferBank(input: CalcInput, bank: string | null): CalcInput {
  return { ...input, salaryTransferBank: bank };
}

export function setCardUsageBank(input: CalcInput, bank: string | null): CalcInput {
  return { ...input, cardUsageBank: bank };
}

export function setProductConditionOverride(
  input: CalcInput,
  finPrdtCd: string,
  code: BankScopedConditionCode,
): CalcInput {
  return {
    ...input,
    productConditionOverrides: {
      ...input.productConditionOverrides,
      [finPrdtCd]: { ...input.productConditionOverrides[finPrdtCd], [code]: true },
    },
  };
}
