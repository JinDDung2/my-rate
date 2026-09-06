import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateInterest, type InterestParams, type InterestResult } from './interest';

const TAX_RATE = 0.154;
const resultFields = [
  'principal',
  'pretaxInterest',
  'tax',
  'afterTaxInterest',
  'maturityAmount',
] as const;

function params(
  monthlyDeposit: number,
  months: number,
  annualRate: number,
  interestType: InterestParams['interestType'],
): InterestParams {
  return { monthlyDeposit, months, annualRate, interestType };
}

function assertDerivedValues(input: InterestParams, result: InterestResult) {
  assert.equal(result.principal, input.monthlyDeposit * input.months);
  assert.equal(result.tax, Math.floor(result.pretaxInterest * TAX_RATE));
  assert.equal(result.afterTaxInterest, result.pretaxInterest - result.tax);
  assert.equal(result.maturityAmount, result.principal + result.afterTaxInterest);

  for (const field of resultFields) {
    assert.equal(Number.isInteger(result[field]), true, `${field} should be an integer`);
  }
}

describe('interest calculation', () => {
  it('T1 calculates simple pretax interest for 12 monthly deposits at 3%', () => {
    const input = params(100_000, 12, 0.03, 'S');
    const result = calculateInterest(input);

    assert.equal(result.pretaxInterest, 19_500);
    assertDerivedValues(input, result);
  });

  it('T2 rounds simple pretax interest once for one month at 12%', () => {
    const input = params(100_000, 1, 0.12, 'S');
    const result = calculateInterest(input);

    assert.equal(result.pretaxInterest, 1_000);
    assertDerivedValues(input, result);
  });

  it('T3 keeps monthly compound pretax interest greater than or equal to simple interest', () => {
    const cases = [
      params(100_000, 36, 0.05, 'S'),
      params(10_000, 6, 0.000001, 'S'),
      params(500_000, 24, 0.03, 'S'),
      params(1_000_000, 12, 0.12, 'S'),
    ];

    for (const simpleInput of cases) {
      const compoundInput = { ...simpleInput, interestType: 'M' as const };
      const simple = calculateInterest(simpleInput);
      const compound = calculateInterest(compoundInput);

      assert.ok(
        compound.pretaxInterest >= simple.pretaxInterest,
        `${simpleInput.monthlyDeposit}/${simpleInput.months}/${simpleInput.annualRate} expected M >= S`,
      );
      assertDerivedValues(simpleInput, simple);
      assertDerivedValues(compoundInput, compound);
    }
  });

  it('T4 returns zero interest and zero tax when annualRate is zero', () => {
    for (const interestType of ['S', 'M'] as const) {
      const input = params(100_000, 12, 0, interestType);
      const result = calculateInterest(input);

      assert.equal(result.pretaxInterest, 0);
      assert.equal(result.tax, 0);
      assert.equal(result.afterTaxInterest, 0);
      assert.equal(result.maturityAmount, result.principal);
      assertDerivedValues(input, result);
    }
  });

  it('derives tax, after-tax interest, principal, and maturity amount from rounded pretax interest', () => {
    const cases = [
      params(100_000, 12, 0.03, 'S'),
      params(100_000, 12, 0.03, 'M'),
      params(500_000, 24, 0.045, 'S'),
      params(500_000, 24, 0.045, 'M'),
      params(1_000_000, 36, 0.12, 'S'),
      params(1_000_000, 36, 0.12, 'M'),
    ];

    for (const input of cases) {
      assertDerivedValues(input, calculateInterest(input));
    }
  });

  it('keeps rounded pretax interest stable across common floating point edges', () => {
    for (const annualRate of [0.01, 0.03, 0.045, 0.12]) {
      for (const months of [6, 12, 24, 36]) {
        for (const monthlyDeposit of [10_000, 500_000, 1_000_000]) {
          for (const interestType of ['S', 'M'] as const) {
            const input = params(monthlyDeposit, months, annualRate, interestType);
            const result = calculateInterest(input);

            assert.equal(Number.isInteger(result.pretaxInterest), true);
            assert.equal(Math.round(result.pretaxInterest), result.pretaxInterest);
            assertDerivedValues(input, result);
          }
        }
      }
    }
  });

  it('guards non-positive deposit or month inputs with zero interest', () => {
    const cases = [
      params(0, 12, 0.03, 'S'),
      params(100_000, 0, 0.03, 'M'),
      params(100_000, -1, 0.03, 'S'),
    ];

    for (const input of cases) {
      const result = calculateInterest(input);

      assert.equal(result.pretaxInterest, 0);
      assert.equal(result.tax, 0);
      assert.equal(result.afterTaxInterest, 0);
      assert.equal(result.maturityAmount, result.principal);
      assertDerivedValues(input, result);
    }
  });
});
