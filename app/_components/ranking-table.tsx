import { Fragment } from 'react';
import { ProductConditions } from '@/app/_components/product-conditions';
import type { BankScopedConditionCode } from '@/lib/calc-input';
import { formatKrw } from '@/lib/format';
import type { RankingRow } from '@/lib/ranking';

interface RankingTableProps {
  rows: RankingRow[];
  onConditionConfirm: (finPrdtCd: string, code: BankScopedConditionCode) => void;
}

export function RankingTable({ rows, onConditionConfirm }: RankingTableProps) {
  return (
    <section
      aria-labelledby="ranking-table-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">[B] 결과 랭킹 테이블</p>
          <h2 id="ranking-table-heading" className="mt-1 text-xl font-semibold text-slate-950">
            세후이자 순위
          </h2>
        </div>
        <p className="text-sm text-slate-600">{rows.length}개 상품</p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-700">
          선택한 기간에 해당하는 상품이 없습니다.
        </p>
      ) : (
        <div
          aria-label="세후이자 랭킹 테이블 가로 스크롤 영역"
          className="mt-4 overflow-x-auto rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
          role="region"
          tabIndex={0}
        >
          <table className="min-w-[720px] w-full border-collapse text-left text-sm">
            <caption className="sr-only">
              사용자가 입력한 월 납입액, 기간, 적립 방식, 우대조건 기준 세후이자 랭킹
            </caption>
            <thead>
              <tr className="border-y border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
                <th className="w-16 px-3 py-3" scope="col">
                  순위
                </th>
                <th className="w-36 px-3 py-3" scope="col">
                  은행
                </th>
                <th className="min-w-64 px-3 py-3" scope="col">
                  상품명
                </th>
                <th className="w-24 px-3 py-3 text-right" scope="col">
                  광고금리
                </th>
                <th className="w-24 px-3 py-3 text-right" scope="col">
                  내금리
                </th>
                <th className="w-36 px-3 py-3 text-right" scope="col">
                  세후실수령
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <Fragment key={`${row.finPrdtCd}-${row.option.saveTrm}-${row.option.rsrvType}`}>
                  <tr className="text-slate-800">
                    <td className="px-3 py-3 font-semibold text-slate-950">{row.rank}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.companyName}</td>
                    <td className="px-3 py-3 text-slate-700">
                      {row.productName}
                      {row.myRateResult.unconfirmed.length > 0 ? (
                        <span className="ml-2 inline-flex rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-900">
                          미확인 {row.myRateResult.unconfirmed.length}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{row.maxRate.toFixed(2)}%</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-950">
                      {row.myRate.toFixed(2)}%
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-950">
                      {formatKrw(row.afterTaxInterest)}원
                    </td>
                  </tr>
                  {row.myRateResult.unconfirmed.length > 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 pb-3">
                        <details className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                          <summary
                            aria-label={`${row.companyName} ${row.productName} ${row.option.saveTrm}개월 ${row.option.rsrvType === 'S' ? '정액적립식' : '자유적립식'} 조건 확인`}
                            className="cursor-pointer rounded-sm text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                          >
                            조건 확인
                          </summary>
                          <ProductConditions
                            result={row.myRateResult}
                            onConfirm={(code) => onConditionConfirm(row.finPrdtCd, code)}
                          />
                        </details>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
