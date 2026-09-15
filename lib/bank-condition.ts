import type { BankScopedConditionCode, CalcInput, CheckableConditionCode } from '@/lib/calc-input';
import { isBankScopedCondition } from '@/lib/conditions';
import type { Product } from '@/lib/types';

// notMet is reserved for a future explicit negative bank-condition response.
export type BankConditionStatus = 'applied' | 'notMet' | 'unconfirmed';
export type ConditionStatusResolver = (code: CheckableConditionCode) => BankConditionStatus;

export function resolveBankScopedStatus(
  code: BankScopedConditionCode,
  companyName: string,
  finPrdtCd: string,
  input: CalcInput,
): BankConditionStatus {
  if (input.productConditionOverrides[finPrdtCd]?.[code]) return 'applied';
  if (code === 'FIRST_CUSTOMER') return 'unconfirmed';
  const selectedBank = code === 'SALARY_TRANSFER' ? input.salaryTransferBank : input.cardUsageBank;
  return selectedBank && selectedBank === companyName ? 'applied' : 'unconfirmed';
}

export function createConditionStatusResolver(
  product: Pick<Product, 'companyName' | 'finPrdtCd'>,
  input: CalcInput,
): ConditionStatusResolver {
  return (code) => isBankScopedCondition(code)
    ? resolveBankScopedStatus(code, product.companyName, product.finPrdtCd, input)
    : input.selectedConditions.includes(code) ? 'applied' : 'notMet';
}

export function getBankNames(products: readonly Pick<Product, 'companyName'>[]): string[] {
  return [...new Set(products.map((product) => product.companyName))].sort();
}
