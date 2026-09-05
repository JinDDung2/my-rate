'use client';

import { ConditionPanel } from '@/app/_components/condition-panel';
import { ProductList } from '@/app/_components/product-list';
import { RESERVE_TYPE_LABELS } from '@/lib/calc-input';
import { CONDITION_META } from '@/lib/conditions';
import { useCalcInput } from '@/lib/use-calc-input';
import { formatKrw } from '@/lib/format';

export function Calculator() {
  const calcInput = useCalcInput();
  const { input } = calcInput;

  return (
    <div className="grid gap-8">
      <ConditionPanel
        amountError={calcInput.amountError}
        amountText={calcInput.amountText}
        input={input}
        onAmountStep={calcInput.stepAmount}
        onAmountTextChange={calcInput.setAmountText}
        onConditionToggle={calcInput.toggleCondition}
        onReserveTypeChange={calcInput.setReserveType}
        onTermMonthsChange={calcInput.setTermMonths}
      />

      <section
        aria-labelledby="committed-input-heading"
        className="rounded-lg border border-slate-200 bg-slate-50 p-4"
      >
        <h2 id="committed-input-heading" className="text-sm font-semibold text-slate-900">
          커밋된 입력 요약
        </h2>
        <p className="mt-2 text-base text-slate-800">
          월 {formatKrw(input.monthlyAmount)}원 · {input.termMonths}개월 ·{' '}
          {RESERVE_TYPE_LABELS[input.reserveType]} · 선택 조건 {input.selectedConditions.length}개
        </p>
        {input.selectedConditions.length > 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            {input.selectedConditions.map((code) => CONDITION_META[code].label).join(', ')}
          </p>
        ) : null}
      </section>

      <ProductList />
    </div>
  );
}
