'use client';

import { useEffect, useMemo } from 'react';
import { ActionListCard } from '@/app/_components/action-list-card';
import { ConditionPanel } from '@/app/_components/condition-panel';
import { ProductList } from '@/app/_components/product-list';
import { RankingTable } from '@/app/_components/ranking-table';
import { TopProductCard } from '@/app/_components/top-product-card';
import { getBankNames } from '@/lib/bank-condition';
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
    input,
    products.data,
    products.status,
  ]);

  const bankNames = useMemo(
    () => (products.status === 'success' ? getBankNames(products.data.products) : []),
    [products.data, products.status],
  );

  const { setSalaryTransferBank, setCardUsageBank } = calcInput;

  // 공유 URL(sb/cb)은 검증 없이 은행명을 그대로 담고 있을 수 있다(예: 데이터가
  // disclosureMonth 갱신으로 바뀌어 해당 은행이 더 이상 없는 경우). 실제 은행 목록이
  // 로드된 뒤 더 이상 존재하지 않는 은행이 선택돼 있으면 초기화해, <select>가 보여주는
  // "선택 안 함"과 내부 상태가 어긋나는 것을 막는다.
  useEffect(() => {
    if (products.status !== 'success') return;
    const validBanks = new Set(bankNames);
    if (input.salaryTransferBank && !validBanks.has(input.salaryTransferBank)) {
      setSalaryTransferBank(null);
    }
    if (input.cardUsageBank && !validBanks.has(input.cardUsageBank)) {
      setCardUsageBank(null);
    }
  }, [
    bankNames,
    products.status,
    input.salaryTransferBank,
    input.cardUsageBank,
    setSalaryTransferBank,
    setCardUsageBank,
  ]);

  return (
    <div className="grid gap-8">
      <ConditionPanel
        amountError={calcInput.amountError}
        amountText={calcInput.amountText}
        input={input}
        bankNames={bankNames}
        onSalaryTransferBankChange={calcInput.setSalaryTransferBank}
        onCardUsageBankChange={calcInput.setCardUsageBank}
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

      {rankingRows ? <RankingTable rows={rankingRows} /> : null}

      {rankingRows && rankingRows.length > 0 ? (
        <TopProductCard
          rankingRows={rankingRows}
          onConditionConfirm={calcInput.setProductConditionOverride}
        />
      ) : null}

      {rankingRows && rankingRows.length > 0 && products.status === 'success' ? (
        <ActionListCard rankingRows={rankingRows} products={products.data.products} input={input} />
      ) : null}

      <ProductList products={products} />
    </div>
  );
}
