'use client';

import { useMemo } from 'react';
import { ConditionPanel } from '@/app/_components/condition-panel';
import { ProductList } from '@/app/_components/product-list';
import { RESERVE_TYPE_LABELS } from '@/lib/calc-input';
import { CONDITION_META } from '@/lib/conditions';
import { useCalcInput } from '@/lib/use-calc-input';
import { formatKrw } from '@/lib/format';
import { calculateMyRate, findRateOption } from '@/lib/my-rate';
import { useProducts } from '@/lib/use-products';

export function Calculator() {
  const calcInput = useCalcInput();
  const { input } = calcInput;
  const products = useProducts();
  const ratePreview = useMemo(() => {
    if (products.status !== 'success') {
      return null;
    }

    const rows = products.data.products.flatMap((product) => {
      const option = findRateOption(product, input.termMonths, input.reserveType);
      if (!option) return [];

      return [
        {
          product,
          option,
          result: calculateMyRate(product, option, input.selectedConditions),
        },
      ];
    });

    rows.sort((a, b) => {
      if (b.result.myRateBp !== a.result.myRateBp) return b.result.myRateBp - a.result.myRateBp;
      return b.result.maxRate - a.result.maxRate;
    });

    return {
      count: rows.length,
      topRows: rows.slice(0, 3),
    };
  }, [input.reserveType, input.selectedConditions, input.termMonths, products]);

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

      {/* 임시: 이슈 #5 랭킹 테이블로 대체 */}
      {ratePreview ? (
        <section
          aria-labelledby="my-rate-preview-heading"
          className="rounded-lg border border-slate-200 bg-white p-4"
        >
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">선택한 만기/적립방식 매칭</p>
              <h2 id="my-rate-preview-heading" className="mt-1 text-xl font-semibold text-slate-950">
                내 금리 상위 미리보기
              </h2>
            </div>
            <p className="text-sm text-slate-500">{ratePreview.count}개 상품</p>
          </div>
          {ratePreview.topRows.length > 0 ? (
            <ol className="mt-4 grid gap-3">
              {ratePreview.topRows.map(({ product, option, result }) => (
                <li
                  className="flex flex-col gap-1 border-b border-slate-100 pb-3 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  key={`${product.finPrdtCd}-${option.saveTrm}-${option.rsrvType}-${option.baseRate}-${option.maxRate}`}
                >
                  <span className="text-sm font-medium text-slate-900">
                    {product.companyName} {product.productName}
                  </span>
                  <span className="text-sm text-slate-600">
                    기본 {option.baseRate.toFixed(2)}% -&gt; 내 금리 {result.myRate.toFixed(2)}%
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-4 text-sm text-slate-600">매칭되는 상품이 없습니다.</p>
          )}
        </section>
      ) : null}

      <ProductList products={products} />
    </div>
  );
}
