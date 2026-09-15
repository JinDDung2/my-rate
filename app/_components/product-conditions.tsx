import type { BankScopedConditionCode } from '@/lib/calc-input';
import { isBankScopedCondition } from '@/lib/conditions';
import { formatRateBpPercentPoint } from '@/lib/format';
import type { MyRateResult } from '@/lib/my-rate';
import type { SpecialCondition } from '@/lib/types';

interface ConditionListProps {
  conditions: SpecialCondition[];
  onConfirm?: (code: BankScopedConditionCode) => void;
}

function ConditionList({ conditions, onConfirm }: ConditionListProps) {
  if (conditions.length === 0) {
    return <p className="text-sm text-slate-600">없음</p>;
  }

  return (
    <ul className="grid gap-2">
      {conditions.map((condition, index) => (
        <li
          className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          key={`${condition.code}-${condition.label}-${condition.rateBp}-${index}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-900">{condition.label}</span>
            <span className="font-medium tabular-nums text-slate-950">
              {formatRateBpPercentPoint(condition.rateBp)}
            </span>
            <span className="inline-flex items-center rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-xs font-medium text-sky-900">
              AI 해석
            </span>
          </div>
          {onConfirm && isBankScopedCondition(condition.code) ? (
            <label className="mt-2 flex items-center gap-2 text-amber-900">
              <input type="checkbox" checked={false}
                aria-label={`${condition.label} 확인/의향 있음`}
                onChange={() => {
                  if (isBankScopedCondition(condition.code)) onConfirm(condition.code);
                }} />
              확인/의향 있음
            </label>
          ) : null}
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-slate-600">
            {condition.evidence}
          </p>
        </li>
      ))}
    </ul>
  );
}

interface ProductConditionsProps {
  result: MyRateResult;
  onConfirm: (code: BankScopedConditionCode) => void;
}

export function ProductConditions({ result, onConfirm }: ProductConditionsProps) {
  return (
    <div className="mt-5 grid gap-4">
      <div>
        <h3 className="text-sm font-semibold text-emerald-700">충족 O</h3>
        <div className="mt-2">
          <ConditionList conditions={result.applied} />
        </div>
      </div>
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
        <h3 className="text-sm font-semibold text-amber-900">미확인 ?</h3>
        <div className="mt-2">
          <ConditionList conditions={result.unconfirmed}
            onConfirm={onConfirm} />
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-500">미충족 X</h3>
        <div className="mt-2">
          <ConditionList conditions={result.notMet} />
        </div>
      </div>
    </div>
  );
}
