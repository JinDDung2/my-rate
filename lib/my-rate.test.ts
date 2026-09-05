import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import productsData from '../data/products.json';
import { CHECKABLE_CONDITION_CODES } from './conditions';
import {
  calculateMyRate,
  findRateOption,
  isCountable,
  toBp,
  type MyRateResult,
} from './my-rate';
import { CONDITION_CODES, type Product, type RateOption, type SpecialCondition } from './types';
import type { CheckableConditionCode } from './calc-input';

const products = productsData.products as Product[];
const allCheckableConditions = [...CHECKABLE_CONDITION_CODES];

function condition(
  code: SpecialCondition['code'],
  rateBp: number,
  conditionLabel: string = code,
): SpecialCondition {
  return {
    code,
    label: conditionLabel,
    rateBp,
    evidence: `${conditionLabel} evidence`,
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
    baseRate: 3.2,
    maxRate: 4.2,
    ...overrides,
  };
}

function assertConditionPartition(product: Product, result: MyRateResult) {
  const buckets = [result.applied, result.unapplied, result.excluded];
  const flattened = buckets.flat();

  assert.equal(flattened.length, product.conditions.length);
  assert.equal(new Set(flattened).size, product.conditions.length);
  assert.deepEqual(new Set(flattened), new Set(product.conditions));

  for (const bucket of buckets) {
    const sorted = [...bucket].sort((a, b) => {
      const codeOrder = CONDITION_CODES.indexOf(a.code) - CONDITION_CODES.indexOf(b.code);
      if (codeOrder !== 0) return codeOrder;
      return product.conditions.indexOf(a) - product.conditions.indexOf(b);
    });
    assert.deepEqual(bucket, sorted);
  }
}

describe('my-rate calculation', () => {
  it('T6 keeps base rate when no conditions are selected for every real option', () => {
    for (const product of products) {
      for (const option of product.options) {
        const result = calculateMyRate(product, option, []);

        assert.equal(result.myRate, option.baseRate);
        assert.equal(result.myRateBp, toBp(option.baseRate));
      }
    }
  });

  it('T5 clamps the real KB product at maxRate when all checkable conditions are selected', () => {
    const product = products.find((item) => item.finPrdtCd === '010200100070');

    if (!product) {
      return it.skip('real fixture 010200100070 is absent from data/products.json');
    }

    const option = findRateOption(product, 12, 'S');
    assert.ok(option);

    const result = calculateMyRate(product, option, allCheckableConditions);

    assert.equal(result.clamped, true);
    assert.equal(result.myRate, 3.15);
    assert.equal(result.myRate, option.maxRate);
    assert.equal(result.clampedAwayBp, 10);
    assert.equal(result.appliedBp, 70);

    for (const termMonths of [6, 12, 24, 36] as const) {
      const termOption = findRateOption(product, termMonths, 'S');
      assert.ok(termOption);
      const termResult = calculateMyRate(product, termOption, allCheckableConditions);
      assert.equal(termResult.myRate, termOption.maxRate);
    }
  });

  it('T5 clamps synthetic rates by basis points', () => {
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 80),
        condition('CARD_USAGE', 70),
        condition('OTHER', 100),
      ],
    });
    const option = optionFixture({ baseRate: 2.45, maxRate: 3.1 });
    const result = calculateMyRate(product, option, ['CARD_USAGE', 'SALARY_TRANSFER']);

    assert.equal(result.myRate, 3.1);
    assert.equal(result.myRateBp, 310);
    assert.equal(result.appliedBp, 150);
    assert.equal(result.clamped, true);
    assert.equal(result.clampedAwayBp, 85);
  });

  it('excludes OTHER and unsupported checked conditions from the sum', () => {
    const product = products.find((item) => item.finPrdtCd === '010200100070');

    if (!product) {
      return it.skip('real fixture 010200100070 is absent from data/products.json');
    }

    const option = findRateOption(product, 12, 'S');
    assert.ok(option);

    const result = calculateMyRate(product, option, allCheckableConditions);
    assert.equal(result.appliedBp, 70);
    assert.equal(result.excluded.filter((item) => item.code === 'OTHER').length, 2);

    const unsupportedOnly = calculateMyRate(product, option, ['MARKETING_AGREE', 'APP_MISSION']);
    assert.equal(unsupportedOnly.myRate, option.baseRate);
    assert.equal(unsupportedOnly.appliedBp, 0);
  });

  it('sums duplicate condition rows for the same checked code', () => {
    const product = products.find((item) => item.finPrdtCd === '010200100070');

    if (!product) {
      return it.skip('real fixture 010200100070 is absent from data/products.json');
    }

    const option = findRateOption(product, 12, 'S');
    assert.ok(option);

    const result = calculateMyRate(product, option, ['AUTO_TRANSFER']);

    assert.equal(result.applied.length, 2);
    assert.equal(result.appliedBp, 20);
    assert.equal(result.myRate, option.baseRate + 0.2);
  });

  it('puts zero-rate conditions in excluded even when checked', () => {
    const zeroRate = condition('CARD_USAGE', 0, 'zero card');
    const product = productFixture({ conditions: [zeroRate, condition('SALARY_TRANSFER', 10)] });
    const result = calculateMyRate(product, optionFixture(), ['CARD_USAGE', 'SALARY_TRANSFER']);

    assert.deepEqual(result.applied, [product.conditions[1]]);
    assert.deepEqual(result.unapplied, []);
    assert.deepEqual(result.excluded, [zeroRate]);
  });

  it('partitions and sorts all condition rows deterministically', () => {
    const conditions = [
      condition('OTHER', 10),
      condition('AUTO_TRANSFER', 10, 'auto 1'),
      condition('SALARY_TRANSFER', 10),
      condition('AUTO_TRANSFER', 20, 'auto 2'),
      condition('CARD_USAGE', 0),
      condition('LINKED_PRODUCT', 10),
    ];
    const product = productFixture({ conditions });
    const first = calculateMyRate(product, optionFixture(), ['LINKED_PRODUCT', 'AUTO_TRANSFER']);
    const second = calculateMyRate(product, optionFixture(), ['AUTO_TRANSFER', 'LINKED_PRODUCT']);

    assertConditionPartition(product, first);
    assert.deepEqual(first, second);
    assert.deepEqual(first.applied, [conditions[1], conditions[3], conditions[5]]);
    assert.deepEqual(first.unapplied, [conditions[2]]);
    assert.deepEqual(first.excluded, [conditions[4], conditions[0]]);
  });

  it('preserves condition objects for later detail screens', () => {
    const richCondition = condition('SALARY_TRANSFER', 15, 'salary');
    const product = productFixture({ conditions: [richCondition] });
    const result = calculateMyRate(product, optionFixture(), ['SALARY_TRANSFER']);

    assert.equal(result.applied[0], richCondition);
    assert.equal(result.applied[0].label, 'salary');
    assert.equal(result.applied[0].rateBp, 15);
    assert.equal(result.applied[0].evidence, 'salary evidence');
    assert.equal(result.applied[0].confidence, 'high');
  });

  it('T7 does not add unexplainedBp for real products that have it', () => {
    const productsWithUnexplainedRate = products.filter((product) => product.unexplainedBp > 0);
    assert.equal(productsWithUnexplainedRate.length, 8);

    for (const product of productsWithUnexplainedRate) {
      for (const option of product.options) {
        const result = calculateMyRate(product, option, allCheckableConditions);
        assert.ok(
          result.myRate < option.maxRate,
          `${product.finPrdtCd} ${option.saveTrm}/${option.rsrvType} should stay below maxRate`,
        );
      }
    }
  });

  it('T7 allows applied conditions while still leaving maxRate unreached', () => {
    const product = productFixture({
      conditions: [condition('SALARY_TRANSFER', 20), condition('OTHER', 40)],
      unexplainedBp: 80,
    });
    const result = calculateMyRate(
      product,
      optionFixture({ baseRate: 2.3, maxRate: 3.2 }),
      ['SALARY_TRANSFER'],
    );

    assert.equal(result.appliedBp, 20);
    assert.equal(result.myRate, 2.5);
    assert.ok(result.myRate < result.maxRate);
  });

  it('keeps basis-point arithmetic exact at common floating point edges', () => {
    const rateCases = [2.2, 2.3, 2.45, 3.2, 3.05, 2.55];

    for (const baseRate of rateCases) {
      for (const rateBp of [10, 20, 30, 40, 50, 60, 70]) {
        const result = calculateMyRate(
          productFixture({ conditions: [condition('SALARY_TRANSFER', rateBp)] }),
          optionFixture({ baseRate, maxRate: baseRate + 2 }),
          ['SALARY_TRANSFER'],
        );

        assert.equal(result.myRateBp, toBp(baseRate) + rateBp);
        assert.equal(Number((result.myRate * 100).toFixed(8)), result.myRateBp);
        assert.equal(result.myRate, result.myRateBp / 100);
      }
    }

    const exactResult = calculateMyRate(
      productFixture({ conditions: [condition('SALARY_TRANSFER', 10)] }),
      optionFixture({ baseRate: 3.2, maxRate: 4 }),
      ['SALARY_TRANSFER'],
    );
    assert.equal(exactResult.myRate, 3.3);
    assert.notEqual(exactResult.myRate, 3.3000000000000003);
  });

  it('returns null when no matching rate option exists', () => {
    const productWithoutSixMonthFixed = products.find((product) => !findRateOption(product, 6, 'S'));
    assert.ok(productWithoutSixMonthFixed);
    assert.equal(findRateOption(productWithoutSixMonthFixed, 6, 'S'), null);
  });

  it('holds full-data invariants for representative condition subsets', () => {
    const selectedSets: CheckableConditionCode[][] = [
      [],
      allCheckableConditions,
      ['AUTO_TRANSFER'],
      ['SALARY_TRANSFER', 'CARD_USAGE', 'NON_FACE_TO_FACE'],
      ['APP_MISSION', 'LINKED_PRODUCT', 'FIRST_CUSTOMER'],
    ];

    for (const product of products) {
      for (const option of product.options) {
        for (const selected of selectedSets) {
          const result = calculateMyRate(product, option, selected);

          assert.ok(result.myRate >= option.baseRate);
          assert.ok(result.myRate <= option.maxRate);
          assertConditionPartition(product, result);
          assert.equal(
            result.appliedBp,
            result.applied.reduce((sum, item) => sum + item.rateBp, 0),
          );
          assert.equal(
            result.clamped,
            toBp(option.baseRate) + result.appliedBp > toBp(option.maxRate),
          );
          assert.equal(result.excluded.every((item) => !isCountable(item)), true);
          assert.equal(result.applied.every(isCountable), true);
          assert.equal(result.unapplied.every(isCountable), true);
        }
      }
    }
  });
});
