import type { CalcInput } from '@/lib/calc-input';
import { formatKrw } from '@/lib/format';
import { buildActionList } from '@/lib/action-list';
import type { RankingRow } from '@/lib/ranking';
import type { Product } from '@/lib/types';

interface ActionListCardProps {
  rankingRows: RankingRow[];
  products: Product[];
  input: CalcInput;
}

export function ActionListCard({ rankingRows, products, input }: ActionListCardProps) {
  const topRow = rankingRows[0];

  if (!topRow) return null;

  const product = products.find((item) => item.finPrdtCd === topRow.finPrdtCd);

  if (!product) return null;

  const actions = buildActionList(product, topRow.option, input);

  if (actions.length === 0) return null;

  return (
    <section
      aria-labelledby="action-list-heading"
      className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <p className="text-sm font-medium text-slate-600">[D] 액션 리스트</p>
        <h2 id="action-list-heading" className="mt-1 text-xl font-semibold text-slate-950">
          추가 조건별 예상 증가액
        </h2>
      </div>

      <ul className="mt-4 divide-y divide-slate-100">
        {actions.map((action) => (
          <li className="flex items-center justify-between gap-4 py-3" key={action.code}>
            <span className="text-sm font-medium text-slate-800">
              {action.label}를 추가하면
            </span>
            <span className="shrink-0 text-base font-semibold tabular-nums text-slate-950">
              +{formatKrw(action.afterTaxInterestDelta)}원
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
