import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import productsData from '../data/products.json';
import { createConditionStatusResolver, getBankNames, resolveBankScopedStatus } from './bank-condition';
import { DEFAULT_CALC_INPUT, setProductConditionOverride, type BankScopedConditionCode } from './calc-input';
import { buildRanking } from './ranking';
import { buildActionList } from './action-list';
import { calculateMyRate, isCountable } from './my-rate';
import type { Product } from './types';

const codes: BankScopedConditionCode[] = ['SALARY_TRANSFER', 'CARD_USAGE', 'FIRST_CUSTOMER'];
const products = productsData.products as Product[];
const fixture = (id: string, bank: string): Product => ({
  ...products[0], finPrdtCd: id, companyName: bank,
  conditions: codes.map((code) => ({
    code, label: code, rateBp: 20, evidence: code, confidence: 'high',
  })),
  options: [{ saveTrm: 12, rsrvType: 'S', intrRateType: 'S', baseRate: 3, maxRate: 5 }],
});

describe('bank-scoped conditions', () => {
  it('applies salary and card only to their independently selected banks', () => {
    const input = { ...DEFAULT_CALC_INPUT, salaryTransferBank: 'A은행', cardUsageBank: 'B은행' };
    for (const code of codes) {
      assert.equal(resolveBankScopedStatus(code, 'C은행', 'C', input), 'unconfirmed');
    }
    assert.equal(resolveBankScopedStatus('SALARY_TRANSFER', 'A은행', 'A', input), 'applied');
    assert.equal(resolveBankScopedStatus('CARD_USAGE', 'A은행', 'A', input), 'unconfirmed');
    assert.equal(resolveBankScopedStatus('CARD_USAGE', 'B은행', 'B', input), 'applied');
    const rows = buildRanking([fixture('A', 'A은행'), fixture('B', 'B은행')], input);
    assert.deepEqual(rows.find((r) => r.finPrdtCd === 'A')?.myRateResult.applied.map((c) => c.code), ['SALARY_TRANSFER']);
    assert.deepEqual(rows.find((r) => r.finPrdtCd === 'B')?.myRateResult.applied.map((c) => c.code), ['CARD_USAGE']);
  });

  it('confirms only the specified product, including products at the same bank', () => {
    const products = [fixture('A', 'A은행'), fixture('B', 'B은행'), fixture('B2', 'B은행')];
    const input = { ...DEFAULT_CALC_INPUT, salaryTransferBank: 'A은행' };
    const before = buildRanking(products, input);
    for (const code of codes) {
      const next = setProductConditionOverride(input, 'B', code);
      const after = buildRanking(products, next);
      const bBefore = before.find((r) => r.finPrdtCd === 'B')!;
      const bAfter = after.find((r) => r.finPrdtCd === 'B')!;
      assert.deepEqual(bAfter.myRateResult.applied.map((c) => c.code), [code]);
      assert.equal(bAfter.myRateResult.myRateBp - bBefore.myRateResult.myRateBp, 20);
      assert.ok(bAfter.afterTaxInterest > bBefore.afterTaxInterest);
      for (const id of ['A', 'B2']) {
        assert.deepEqual(after.find((r) => r.finPrdtCd === id)?.myRateResult,
          before.find((r) => r.finPrdtCd === id)?.myRateResult);
      }
      assert.deepEqual(input.productConditionOverrides, {});
    }
    const next = setProductConditionOverride(setProductConditionOverride(input, 'B', 'FIRST_CUSTOMER'), 'B', 'SALARY_TRANSFER');
    assert.deepEqual(next.productConditionOverrides.B, { FIRST_CUSTOMER: true, SALARY_TRANSFER: true });
  });

  it('starts every countable bank condition unconfirmed across all real products and options', () => {
    let count = 0;
    for (const product of products) {
      for (const option of product.options) {
        const result = calculateMyRate(product, option, createConditionStatusResolver(product, DEFAULT_CALC_INPUT));
        const bankConditions = product.conditions.filter((c) => codes.includes(c.code as BankScopedConditionCode) && isCountable(c));
        assert.deepEqual(new Set(result.unconfirmed), new Set(bankConditions));
        count += result.unconfirmed.length;
        assert.equal(result.applied.length, 0);
        assert.equal(result.myRate, option.baseRate);
        const all = [...result.applied, ...result.notMet, ...result.unconfirmed, ...result.excluded];
        assert.equal(all.length, product.conditions.length);
        assert.deepEqual(new Set(all), new Set(product.conditions));
      }
    }
    assert.ok(count > 0);
  });

  it('simulates unconfirmed conditions using the ranking baseline', () => {
    const product = fixture('B', 'B은행');
    const input = { ...DEFAULT_CALC_INPUT, salaryTransferBank: 'A은행' };
    const before = buildRanking([product], input)[0];
    const actions = buildActionList(product, product.options[0], input);
    assert.equal(actions.length, 3);
    const next = setProductConditionOverride(input, 'B', 'SALARY_TRANSFER');
    const after = buildRanking([product], next)[0];
    assert.equal(actions.find((a) => a.code === 'SALARY_TRANSFER')?.afterTaxInterestDelta,
      after.afterTaxInterest - before.afterTaxInterest);
    assert.ok(!buildActionList(product, product.options[0], next).some((a) => a.code === 'SALARY_TRANSFER'));
  });

  it('derives exactly the 14 disclosed bank names without duplicates', () => {
    const banks = getBankNames(products);
    assert.equal(banks.length, 14);
    assert.deepEqual(banks, [...new Set(products.map((p) => p.companyName))].sort());
    assert.deepEqual(getBankNames([...products].reverse()), banks);
  });
});
