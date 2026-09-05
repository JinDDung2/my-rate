'use client';

import { CHECKABLE_CONDITION_CODES, CONDITION_META } from '@/lib/conditions';
import {
  RESERVE_TYPE_LABELS,
  TERM_OPTIONS,
  type CalcInput,
  type CheckableConditionCode,
  type ReserveType,
  type TermMonths,
} from '@/lib/calc-input';
import { formatKrw } from '@/lib/format';

interface ConditionPanelProps {
  input: CalcInput;
  amountText: string;
  amountError: string | null;
  onAmountTextChange: (value: string) => void;
  onAmountStep: (direction: -1 | 1) => void;
  onTermMonthsChange: (value: TermMonths) => void;
  onReserveTypeChange: (value: ReserveType) => void;
  onConditionToggle: (value: CheckableConditionCode) => void;
}

const RESERVE_TYPE_OPTIONS: ReserveType[] = ['S', 'F'];

export function ConditionPanel({
  input,
  amountText,
  amountError,
  onAmountTextChange,
  onAmountStep,
  onTermMonthsChange,
  onReserveTypeChange,
  onConditionToggle,
}: ConditionPanelProps) {
  const amountDescriptionId = amountError ? 'monthly-amount-error' : 'monthly-amount-help';

  return (
    <section
      aria-labelledby="condition-panel-heading"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="mb-6">
        <p className="text-sm font-medium text-slate-600">[A] 입력 패널</p>
        <h2 id="condition-panel-heading" className="mt-2 text-2xl font-bold text-slate-950">
          내 적금 조건
        </h2>
      </div>

      <div className="grid gap-6">
        <div>
          <label className="text-sm font-semibold text-slate-900" htmlFor="monthly-amount">
            월 납입액
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                aria-describedby={amountDescriptionId}
                aria-invalid={amountError ? true : undefined}
                className="h-12 w-full rounded-md border border-slate-300 bg-white px-3 pr-10 text-base text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
                id="monthly-amount"
                inputMode="numeric"
                onChange={(event) => onAmountTextChange(event.target.value)}
                type="text"
                value={amountText}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                원
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:w-32">
              <button
                aria-label="월 납입액 1만원 줄이기"
                className="h-12 rounded-md border border-slate-300 bg-slate-50 text-lg font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                onClick={() => onAmountStep(-1)}
                type="button"
              >
                -
              </button>
              <button
                aria-label="월 납입액 1만원 늘리기"
                className="h-12 rounded-md border border-slate-300 bg-slate-50 text-lg font-semibold text-slate-800 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
                onClick={() => onAmountStep(1)}
                type="button"
              >
                +
              </button>
            </div>
          </div>
          {amountError ? (
            <p className="mt-2 text-sm font-medium text-red-700" id="monthly-amount-error" role="alert">
              {amountError}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600" id="monthly-amount-help">
              계산 적용 금액: {formatKrw(input.monthlyAmount)}원
            </p>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">가입 기간</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {TERM_OPTIONS.map((termMonths) => (
              <label
                className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 has-[:checked]:border-slate-950 has-[:checked]:bg-slate-950 has-[:checked]:text-white"
                htmlFor={`term-${termMonths}`}
                key={termMonths}
              >
                <input
                  checked={input.termMonths === termMonths}
                  className="h-4 w-4"
                  id={`term-${termMonths}`}
                  name="term-months"
                  onChange={() => onTermMonthsChange(termMonths)}
                  type="radio"
                />
                {termMonths}개월
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">적립 방식</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {RESERVE_TYPE_OPTIONS.map((reserveType) => (
              <label
                className="flex min-h-12 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 has-[:checked]:border-slate-950 has-[:checked]:bg-slate-950 has-[:checked]:text-white"
                htmlFor={`reserve-${reserveType}`}
                key={reserveType}
              >
                <input
                  checked={input.reserveType === reserveType}
                  className="h-4 w-4"
                  id={`reserve-${reserveType}`}
                  name="reserve-type"
                  onChange={() => onReserveTypeChange(reserveType)}
                  type="radio"
                />
                {RESERVE_TYPE_LABELS[reserveType]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">내가 충족할 수 있는 조건</legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {CHECKABLE_CONDITION_CODES.map((code) => (
              <label
                className="flex min-h-12 items-center gap-3 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 has-[:checked]:border-slate-950 has-[:checked]:bg-slate-950 has-[:checked]:text-white"
                htmlFor={`cond-${code}`}
                key={code}
              >
                <input
                  checked={input.selectedConditions.includes(code)}
                  className="h-4 w-4"
                  id={`cond-${code}`}
                  onChange={() => onConditionToggle(code)}
                  type="checkbox"
                />
                <span>{CONDITION_META[code].checkboxLabel}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex min-h-12 items-center justify-between gap-3 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
            <span>{CONDITION_META.OTHER.label}</span>
            <span className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-600">
              선택 불가
            </span>
          </div>
        </fieldset>
      </div>
    </section>
  );
}
