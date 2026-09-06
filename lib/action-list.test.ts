import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { CalcInput } from './calc-input';
import { DEFAULT_CALC_INPUT } from './calc-input';
import { calculateInterest } from './interest';
import { calculateMyRate } from './my-rate';
import { buildRanking } from './ranking';
import { buildActionList } from './action-list';
import type { Product, RateOption, SpecialCondition } from './types';

function input(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    ...DEFAULT_CALC_INPUT,
    monthlyAmount: 100_000,
    termMonths: 12,
    reserveType: 'S',
    selectedConditions: [],
    ...overrides,
  };
}

function condition(
  code: SpecialCondition['code'],
  rateBp: number,
  label: string = code,
): SpecialCondition {
  return {
    code,
    label,
    rateBp,
    evidence: `${label} evidence`,
    confidence: 'high',
  };
}

function productFixture(overrides: Partial<Product> = {}): Product {
  return {
    finPrdtCd: 'fixture',
    companyName: 'fixture bank',
    productName: 'fixture product',
    joinWay: 'online',
    rawSpecialCondition: 'fixture',
    conditions: [],
    options: [],
    disclosureMonth: '202608',
    unexplainedBp: 0,
    reviewed: true,
    ...overrides,
  };
}

function optionFixture(overrides: Partial<RateOption> = {}): RateOption {
  return {
    saveTrm: 12,
    intrRateType: 'S',
    rsrvType: 'S',
    baseRate: 1,
    maxRate: 10,
    ...overrides,
  };
}

function afterTaxInterest(product: Product, option: RateOption, calcInput: CalcInput): number {
  const myRateResult = calculateMyRate(product, option, calcInput.selectedConditions);

  return calculateInterest({
    monthlyDeposit: calcInput.monthlyAmount,
    months: calcInput.termMonths,
    annualRate: myRateResult.myRateBp / 10000,
    interestType: option.intrRateType,
  }).afterTaxInterest;
}

describe('buildActionList', () => {
  it('returns the top 3 unique unmet conditions sorted by after-tax interest delta', () => {
    const option = optionFixture();
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 10),
        condition('CARD_USAGE', 50),
        condition('AUTO_TRANSFER', 20),
        condition('FIRST_CUSTOMER', 40),
        condition('MARKETING_AGREE', 30),
      ],
      options: [option],
    });

    const actions = buildActionList(product, option, input());

    assert.deepEqual(actions.map((action) => action.code), [
      'CARD_USAGE',
      'FIRST_CUSTOMER',
      'MARKETING_AGREE',
    ]);
    assert.deepEqual(actions.map((action) => action.afterTaxInterestDelta), [2750, 2200, 1650]);
    assert.equal(actions.length, 3);
  });

  it('returns an empty list when the baseline is already clamped at maxRate', () => {
    const option = optionFixture({ baseRate: 3, maxRate: 3.5 });
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 50),
        condition('CARD_USAGE', 20),
      ],
      options: [option],
    });

    const actions = buildActionList(
      product,
      option,
      input({ selectedConditions: ['SALARY_TRANSFER'] }),
    );

    assert.deepEqual(actions, []);
  });

  it('keeps partially clamped additions when the effective delta is positive', () => {
    const option = optionFixture({ baseRate: 3, maxRate: 3.5 });
    const product = productFixture({
      conditions: [condition('SALARY_TRANSFER', 100)],
      options: [option],
    });

    const actions = buildActionList(product, option, input());

    assert.equal(actions.length, 1);
    assert.equal(actions[0].code, 'SALARY_TRANSFER');
    assert.equal(actions[0].rateBp, 100);
    assert.equal(actions[0].afterTaxInterestDelta, 2750);
  });

  it('deduplicates duplicate unmet rows by code and sums their rateBp', () => {
    const option = optionFixture();
    const product = productFixture({
      conditions: [
        condition('AUTO_TRANSFER', 10, 'auto 1'),
        condition('AUTO_TRANSFER', 20, 'auto 2'),
      ],
      options: [option],
    });

    const actions = buildActionList(product, option, input());

    assert.equal(actions.length, 1);
    assert.equal(actions[0].code, 'AUTO_TRANSFER');
    assert.equal(actions[0].rateBp, 30);
    assert.equal(actions[0].afterTaxInterestDelta, 1650);
  });

  it('measures each addition on top of already selected conditions', () => {
    const option = optionFixture({ baseRate: 2, maxRate: 5 });
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 100),
        condition('CARD_USAGE', 100),
        condition('AUTO_TRANSFER', 50),
      ],
      options: [option],
    });
    const calcInput = input({ selectedConditions: ['SALARY_TRANSFER'] });

    const actions = buildActionList(product, option, calcInput);
    const baseline = afterTaxInterest(product, option, calcInput);
    const cardOnlyAdded = afterTaxInterest(product, option, {
      ...calcInput,
      selectedConditions: ['SALARY_TRANSFER', 'CARD_USAGE'],
    });
    const combinationAdded = afterTaxInterest(product, option, {
      ...calcInput,
      selectedConditions: ['SALARY_TRANSFER', 'CARD_USAGE', 'AUTO_TRANSFER'],
    });

    assert.equal(actions[0].code, 'CARD_USAGE');
    assert.equal(actions[0].afterTaxInterestDelta, cardOnlyAdded - baseline);
    assert.equal(actions[0].afterTaxInterestDelta, 5499);
    assert.notEqual(actions[0].afterTaxInterestDelta, combinationAdded - baseline);
  });

  it('uses CONDITION_CODES order as the tie-breaker for equal deltas', () => {
    const option = optionFixture();
    const product = productFixture({
      conditions: [
        condition('CARD_USAGE', 20),
        condition('SALARY_TRANSFER', 20),
      ],
      options: [option],
    });

    const actions = buildActionList(product, option, input());

    assert.deepEqual(actions.map((action) => action.code), ['SALARY_TRANSFER', 'CARD_USAGE']);
    assert.deepEqual(actions.map((action) => action.afterTaxInterestDelta), [1100, 1100]);
  });

  it('keeps baseline interest aligned with buildRanking row interest', () => {
    const option = optionFixture({ baseRate: 2.5, maxRate: 4 });
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 50),
        condition('CARD_USAGE', 30),
      ],
      options: [option],
    });
    const calcInput = input({ selectedConditions: ['SALARY_TRANSFER'] });
    const [row] = buildRanking([product], calcInput);

    const [action] = buildActionList(product, option, calcInput);
    const afterAddingCard = afterTaxInterest(product, option, {
      ...calcInput,
      selectedConditions: ['SALARY_TRANSFER', 'CARD_USAGE'],
    });

    assert.equal(action.afterTaxInterestDelta, afterAddingCard - row.interest.afterTaxInterest);
  });
});
