'use client';

import { formatDisclosureMonth } from '@/lib/format';
import { useProducts } from '@/lib/use-products';
import type { Product, RateOption } from '@/lib/types';

function formatRateOption(option: RateOption): string {
  return `${option.saveTrm}개월 ${option.baseRate.toFixed(2)}% ~ ${option.maxRate.toFixed(2)}%`;
}

function ProductRow({ product }: { product: Product }) {
  return (
    <li className="border-b border-slate-200 py-4 last:border-b-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">{product.companyName}</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">{product.productName}</h2>
        </div>
        <p className="text-sm text-slate-500">{product.joinWay}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {product.options.map((option) => (
          <span
            className="rounded border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700"
            key={`${option.saveTrm}-${option.intrRateType}-${option.rsrvType}-${option.baseRate}-${option.maxRate}`}
          >
            {formatRateOption(option)}
          </span>
        ))}
      </div>
    </li>
  );
}

export function ProductList() {
  const products = useProducts();

  if (products.status === 'loading') {
    return <p className="py-10 text-slate-600">상품 데이터를 불러오는 중입니다.</p>;
  }

  if (products.status === 'error') {
    return (
      <div className="py-10">
        <p className="font-medium text-red-700">데이터를 불러오지 못했습니다</p>
        <button
          className="mt-4 rounded bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={products.reload}
          type="button"
        >
          재시도
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="products-heading">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">
            데이터 기준: {formatDisclosureMonth(products.data.disclosureMonth)}
          </p>
          <h1 id="products-heading" className="mt-2 text-3xl font-bold text-slate-950">
            적금 상품 목록
          </h1>
        </div>
        <p className="text-sm text-slate-500">총 {products.data.products.length}개 상품</p>
      </div>
      <ul className="divide-y divide-slate-200 bg-slate-50">
        {products.data.products.map((product) => (
          <ProductRow key={`${product.companyName}-${product.finPrdtCd}`} product={product} />
        ))}
      </ul>
    </section>
  );
}
