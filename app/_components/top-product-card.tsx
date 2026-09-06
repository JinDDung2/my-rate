import { formatKrw, formatRateBpPercentPoint } from '@/lib/format';
import { buildTopProductSummary, type RankingRow } from '@/lib/ranking';
import type { SpecialCondition } from '@/lib/types';

interface TopProductCardProps {
  rankingRows: RankingRow[];
}

interface ConditionListProps {
  conditions: SpecialCondition[];
}

function ConditionList({ conditions }: ConditionListProps) {
  if (conditions.length === 0) {
    return <p className="text-sm text-slate-500">없음</p>;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {conditions.map((condition, index) => (
        <li
          className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700"
          key={`${condition.code}-${condition.label}-${condition.rateBp}-${index}`}
        >
          {condition.label}{' '}
          <span className="font-medium tabular-nums text-slate-950">
            {formatRateBpPercentPoint(condition.rateBp)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function TopProductCard({ rankingRows }: TopProductCardProps) {
  const summary = buildTopProductSummary(rankingRows);

  if (!summary) return null;

  const { myLeader, differsFromAdvertised } = summary;

  return (
    <section
      aria-labelledby="top-product-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-600">[C] 1위 상품 상세 카드</p>
          <h2 id="top-product-heading" className="mt-1 text-xl font-semibold text-slate-950">
            {myLeader.productName}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{myLeader.companyName}</p>
        </div>
        {differsFromAdvertised ? (
          <span className="inline-flex w-fit items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-900">
            광고 1위와 다릅니다
          </span>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-sm font-medium text-slate-600">광고 최고금리</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
            {myLeader.maxRate.toFixed(2)}%
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-600">내 금리</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
            {myLeader.myRate.toFixed(2)}%
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-600">원금</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
            {formatKrw(myLeader.interest.principal)}원
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-600">세후이자</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-950">
            {formatKrw(myLeader.interest.afterTaxInterest)}원
          </dd>
        </div>
      </dl>

      <div className="mt-5 grid gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">충족 O</h3>
          <div className="mt-2">
            <ConditionList conditions={myLeader.myRateResult.applied} />
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">미충족 X</h3>
          <div className="mt-2">
            <ConditionList conditions={myLeader.myRateResult.unapplied} />
          </div>
        </div>
      </div>

      {/* F-09 미해석 우대폭 고지와 F-08 근거 원문 보기는 #8에서 배선한다. */}
    </section>
  );
}
