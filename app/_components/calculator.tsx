'use client';

import { useEffect, useMemo } from 'react';
import { ActionListCard } from '@/app/_components/action-list-card';
import { ConditionPanel } from '@/app/_components/condition-panel';
import { ProductList } from '@/app/_components/product-list';
import { RankingTable } from '@/app/_components/ranking-table';
import { TopProductCard } from '@/app/_components/top-product-card';
import { RESERVE_TYPE_LABELS } from '@/lib/calc-input';
import { CONDITION_META } from '@/lib/conditions';
import { useCalcInput } from '@/lib/use-calc-input';
import { formatKrw } from '@/lib/format';
import { buildRanking } from '@/lib/ranking';
import { hasCalcInputQueryKeys, parseCalcInputFromQuery } from '@/lib/share-url';
import { useProducts } from '@/lib/use-products';

export function Calculator() {
  const calcInput = useCalcInput();
  const { input } = calcInput;
  const { hydrate } = calcInput;
  const products = useProducts();

  useEffect(() => {
    const search = window.location.search;
    if (!hasCalcInputQueryKeys(search)) return;

    hydrate(parseCalcInputFromQuery(search));
  }, [hydrate]);

  const rankingRows = useMemo(() => {
    if (products.status !== 'success') {
      return null;
    }

    return buildRanking(products.data.products, input);
  }, [
    input.monthlyAmount,
    input.reserveType,
    input.selectedConditions,
    input.termMonths,
    products.data,
    products.status,
  ]);

  return (
    <div className="grid gap-8">
      <ConditionPanel
        amountError={calcInput.amountError}
        amountText={calcInput.amountText}
        input={input}
        onAmountStep={calcInput.stepAmount}
        onAmountTextChange={calcInput.setAmountText}
        onConditionsApply={calcInput.applyConditions}
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

      {rankingRows ? <RankingTable rows={rankingRows} /> : null}

      {rankingRows && rankingRows.length > 0 ? <TopProductCard rankingRows={rankingRows} /> : null}

      {rankingRows && rankingRows.length > 0 && products.status === 'success' ? (
        <ActionListCard rankingRows={rankingRows} products={products.data.products} input={input} />
      ) : null}

      <ProductList products={products} />
    </div>
  );
}
