import { CHECKABLE_CONDITION_CODES } from '@/lib/conditions';
import type { ConditionCode, RateOption } from '@/lib/types';

export type CheckableConditionCode = Exclude<ConditionCode, 'OTHER'>;
export type ReserveType = RateOption['rsrvType'];
export type TermMonths = (typeof TERM_OPTIONS)[number];

export interface CalcInput {
  monthlyAmount: number;
  termMonths: TermMonths;
  reserveType: ReserveType;
  selectedConditions: CheckableConditionCode[];
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
};

export type MonthlyAmountParseResult =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'not-a-number' | 'out-of-range' | 'not-a-step' };

export function parseMonthlyAmount(text: string): MonthlyAmountParseResult {
  if (text.trim() === '') {
    return { ok: false, reason: 'empty' };
  }

  if (!/^[\d,]+$/.test(text)) {
    return { ok: false, reason: 'not-a-number' };
  }

  const digits = text.replaceAll(',', '');
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
  codes: CheckableConditionCode[],
  code: CheckableConditionCode,
): CheckableConditionCode[] {
  const next = codes.includes(code)
    ? codes.filter((selectedCode) => selectedCode !== code)
    : [...codes, code];

  return CHECKABLE_CONDITION_CODES.filter((conditionCode) => next.includes(conditionCode));
}

export function clampMonthlyAmount(value: number): number {
  return Math.min(MONTHLY_AMOUNT_MAX, Math.max(MONTHLY_AMOUNT_MIN, value));
}
