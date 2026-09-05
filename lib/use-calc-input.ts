'use client';

import { useCallback, useState } from 'react';
import {
  clampMonthlyAmount,
  DEFAULT_CALC_INPUT,
  MONTHLY_AMOUNT_STEP,
  parseMonthlyAmount,
  toggleCondition as toggleConditionValue,
  type CalcInput,
  type CheckableConditionCode,
  type ReserveType,
  type TermMonths,
} from '@/lib/calc-input';

function getAmountError(text: string): string | null {
  const result = parseMonthlyAmount(text);
  if (result.ok) return null;

  if (result.reason === 'out-of-range') {
    return '10,000원 ~ 1,000,000원 사이로 입력해 주세요';
  }

  if (result.reason === 'not-a-step') {
    return '만원 단위로 입력해 주세요';
  }

  return '숫자로 월 납입액을 입력해 주세요';
}

export function useCalcInput(defaultInput: CalcInput = DEFAULT_CALC_INPUT) {
  const [input, setInput] = useState<CalcInput>(defaultInput);
  const [amountText, setAmountTextState] = useState(() => String(defaultInput.monthlyAmount));
  const [amountError, setAmountError] = useState<string | null>(null);

  const setAmountText = useCallback((nextText: string) => {
    setAmountTextState(nextText);
    setAmountError(getAmountError(nextText));

    const result = parseMonthlyAmount(nextText);
    if (!result.ok) return;

    setInput((current) => ({
      ...current,
      monthlyAmount: result.value,
    }));
  }, []);

  const stepAmount = useCallback((direction: -1 | 1) => {
    setInput((current) => {
      const monthlyAmount = clampMonthlyAmount(
        current.monthlyAmount + direction * MONTHLY_AMOUNT_STEP,
      );
      setAmountTextState(String(monthlyAmount));
      setAmountError(null);

      return {
        ...current,
        monthlyAmount,
      };
    });
  }, []);

  const setTermMonths = useCallback((termMonths: TermMonths) => {
    setInput((current) => ({ ...current, termMonths }));
  }, []);

  const setReserveType = useCallback((reserveType: ReserveType) => {
    setInput((current) => ({ ...current, reserveType }));
  }, []);

  const toggleCondition = useCallback((code: CheckableConditionCode) => {
    setInput((current) => ({
      ...current,
      selectedConditions: toggleConditionValue(current.selectedConditions, code),
    }));
  }, []);

  return {
    input,
    amountText,
    amountError,
    setAmountText,
    stepAmount,
    setTermMonths,
    setReserveType,
    toggleCondition,
  };
}
