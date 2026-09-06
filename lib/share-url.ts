import {
  DEFAULT_CALC_INPUT,
  snapMonthlyAmount,
  TERM_OPTIONS,
  type CalcInput,
  type CheckableConditionCode,
  type ReserveType,
  type TermMonths,
} from '@/lib/calc-input';
import { CHECKABLE_CONDITION_CODES } from '@/lib/conditions';

const QUERY_KEYS = ['m', 't', 'r', 'c'] as const;
const RESERVE_TYPES: ReserveType[] = ['S', 'F'];

function isTermMonths(value: number): value is TermMonths {
  return TERM_OPTIONS.includes(value as TermMonths);
}

function isReserveType(value: string): value is ReserveType {
  return RESERVE_TYPES.includes(value as ReserveType);
}

function parseMonthlyAmount(value: string | null): number {
  if (value === null || value.trim() === '') {
    return DEFAULT_CALC_INPUT.monthlyAmount;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsedValue)) {
    return DEFAULT_CALC_INPUT.monthlyAmount;
  }

  return snapMonthlyAmount(parsedValue);
}

function parseTermMonths(value: string | null): TermMonths {
  if (value === null || value.trim() === '') {
    return DEFAULT_CALC_INPUT.termMonths;
  }

  const parsedValue = Number(value);

  return Number.isInteger(parsedValue) && isTermMonths(parsedValue)
    ? parsedValue
    : DEFAULT_CALC_INPUT.termMonths;
}

function parseReserveType(value: string | null): ReserveType {
  if (value === null || !isReserveType(value)) {
    return DEFAULT_CALC_INPUT.reserveType;
  }

  return value;
}

function normalizeConditions(value: string | null): CheckableConditionCode[] {
  if (value === null || value.trim() === '') {
    return DEFAULT_CALC_INPUT.selectedConditions;
  }

  const selectedSet = new Set(value.split(',').map((code) => code.trim()).filter(Boolean));

  return CHECKABLE_CONDITION_CODES.filter((code) => selectedSet.has(code));
}

export function serializeCalcInput(input: CalcInput): string {
  const selectedSet = new Set(input.selectedConditions);
  const selectedConditions = CHECKABLE_CONDITION_CODES.filter((code) => selectedSet.has(code));

  const query = [
    `m=${input.monthlyAmount}`,
    `t=${input.termMonths}`,
    `r=${input.reserveType}`,
  ];

  if (selectedConditions.length > 0) {
    query.push(`c=${selectedConditions.join(',')}`);
  }

  return query.join('&');
}

export function parseCalcInputFromQuery(search: string): CalcInput {
  const params = new URLSearchParams(search);

  return {
    monthlyAmount: parseMonthlyAmount(params.get('m')),
    termMonths: parseTermMonths(params.get('t')),
    reserveType: parseReserveType(params.get('r')),
    selectedConditions: normalizeConditions(params.get('c')),
  };
}

export function hasCalcInputQueryKeys(search: string): boolean {
  const params = new URLSearchParams(search);

  return QUERY_KEYS.some((key) => params.has(key));
}

interface ShareLocation {
  origin: string;
  pathname: string;
}

export function buildShareUrl(location: ShareLocation, input: CalcInput): string {
  const query = serializeCalcInput(input);
  const origin = location.origin.startsWith('http://') || location.origin.startsWith('https://')
    ? location.origin
    : '';

  return `${origin}${location.pathname}?${query}`;
}
