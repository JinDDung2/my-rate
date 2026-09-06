import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import productsData from '../data/products.json';
import type { CalcInput, CheckableConditionCode } from './calc-input';
import { DEFAULT_CALC_INPUT } from './calc-input';
import { CHECKABLE_CONDITION_CODES } from './conditions';
import { calculateInterest } from './interest';
import { calculateMyRate, findRateOption } from './my-rate';
import { buildRanking } from './ranking';
import type { Product, RateOption, SpecialCondition } from './types';

const products = productsData.products as Product[];
const allCheckableConditions = [...CHECKABLE_CONDITION_CODES];

function input(overrides: Partial<CalcInput> = {}): CalcInput {
  return {
    ...DEFAULT_CALC_INPUT,
    ...overrides,
  };
}

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
    baseRate: 3,
    maxRate: 4,
    ...overrides,
  };
}

function assertSortedByRankingRules(rows: ReturnType<typeof buildRanking>) {
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const current = rows[index];

    assert.ok(previous.afterTaxInterest >= current.afterTaxInterest);
    if (previous.afterTaxInterest === current.afterTaxInterest) {
      assert.ok(previous.option.baseRate >= current.option.baseRate);
    }
    if (
      previous.afterTaxInterest === current.afterTaxInterest &&
      previous.option.baseRate === current.option.baseRate
    ) {
      assert.ok(previous.finPrdtCd <= current.finPrdtCd);
    }
    assert.equal(current.rank, index + 1);
  }
}

describe('ranking calculation', () => {
  it('excludes products without a matching term and reserve type option', () => {
    const matching = productFixture({
      finPrdtCd: 'MATCH',
      options: [optionFixture({ saveTrm: 12, rsrvType: 'S' })],
    });
    const wrongTermOnly = productFixture({
      finPrdtCd: 'WRONG_TERM',
      options: [optionFixture({ saveTrm: 18, rsrvType: 'S' })],
    });
    const wrongReserveOnly = productFixture({
      finPrdtCd: 'WRONG_RESERVE',
      options: [optionFixture({ saveTrm: 12, rsrvType: 'F' })],
    });

    const rows = buildRanking([wrongTermOnly, matching, wrongReserveOnly], input());

    assert.deepEqual(rows.map((row) => row.finPrdtCd), ['MATCH']);
  });

  it('returns an empty ranking when no product has a matching option', () => {
    const wrongTermOnly = productFixture({
      finPrdtCd: 'WRONG_TERM',
      options: [optionFixture({ saveTrm: 18, rsrvType: 'S' })],
    });
    const wrongReserveOnly = productFixture({
      finPrdtCd: 'WRONG_RESERVE',
      options: [optionFixture({ saveTrm: 12, rsrvType: 'F' })],
    });

    const rows = buildRanking([wrongTermOnly, wrongReserveOnly], input());

    assert.deepEqual(rows, []);
  });

  it('filters and ranks free-reserve options when reserveType is F', () => {
    const freeReserve = productFixture({
      finPrdtCd: 'FREE_RESERVE',
      options: [optionFixture({ rsrvType: 'F', baseRate: 3, maxRate: 4 })],
    });
    const fixedReserve = productFixture({
      finPrdtCd: 'FIXED_RESERVE',
      options: [optionFixture({ rsrvType: 'S', baseRate: 4, maxRate: 5 })],
    });

    const rows = buildRanking([fixedReserve, freeReserve], input({ reserveType: 'F' }));

    assert.deepEqual(rows.map((row) => row.finPrdtCd), ['FREE_RESERVE']);
    assert.equal(rows[0].option.rsrvType, 'F');
  });

  it('sorts real products by after-tax interest descending', () => {
    const rows = buildRanking(
      products,
      input({
        monthlyAmount: 500_000,
        termMonths: 12,
        reserveType: 'S',
        selectedConditions: allCheckableConditions,
      }),
    );

    assert.ok(rows.length > 0);
    assertSortedByRankingRules(rows);
    assert.equal(rows.every((row) => row.option.saveTrm === 12 && row.option.rsrvType === 'S'), true);
  });

  it('uses base rate as the tie-breaker when after-tax interest is identical', () => {
    const highBase = productFixture({
      finPrdtCd: 'A_HIGH_BASE',
      options: [optionFixture({ baseRate: 3, maxRate: 4 })],
    });
    const lowBase = productFixture({
      finPrdtCd: 'B_LOW_BASE',
      conditions: [condition('SALARY_TRANSFER', 100)],
      options: [optionFixture({ baseRate: 2, maxRate: 4 })],
    });

    const rows = buildRanking(
      [lowBase, highBase],
      input({ selectedConditions: ['SALARY_TRANSFER'] }),
    );

    assert.equal(rows[0].finPrdtCd, 'A_HIGH_BASE');
    assert.equal(rows[0].afterTaxInterest, rows[1].afterTaxInterest);
    assert.equal(rows[0].option.baseRate, 3);
  });

  it('uses finPrdtCd as the deterministic tie-breaker when interest and base rate are identical', () => {
    const second = productFixture({
      finPrdtCd: 'A_1',
      options: [optionFixture({ baseRate: 3, maxRate: 4 })],
    });
    const first = productFixture({
      finPrdtCd: 'A-1',
      options: [optionFixture({ baseRate: 3, maxRate: 4 })],
    });

    const rows = buildRanking([second, first], input());

    assert.deepEqual(rows.map((row) => row.finPrdtCd), ['A-1', 'A_1']);
    assert.deepEqual(rows.map((row) => row.rank), [1, 2]);
  });

  it('changes ranking when the selected condition set changes', () => {
    const conditional = productFixture({
      finPrdtCd: 'A_CONDITIONAL',
      conditions: [condition('SALARY_TRANSFER', 200)],
      options: [optionFixture({ baseRate: 2, maxRate: 4 })],
    });
    const baseLeader = productFixture({
      finPrdtCd: 'B_BASE_LEADER',
      options: [optionFixture({ baseRate: 3.5, maxRate: 3.5 })],
    });

    const withoutCondition = buildRanking([conditional, baseLeader], input());
    const withCondition = buildRanking(
      [conditional, baseLeader],
      input({ selectedConditions: ['SALARY_TRANSFER'] }),
    );

    assert.equal(withoutCondition[0].finPrdtCd, 'B_BASE_LEADER');
    assert.equal(withCondition[0].finPrdtCd, 'A_CONDITIONAL');
    assert.ok(withCondition[0].afterTaxInterest > withCondition[1].afterTaxInterest);
  });

  it('derives each row interest from myRateBp / 10000 and the matched option interest type', () => {
    const compound = productFixture({
      finPrdtCd: 'COMPOUND',
      conditions: [condition('CARD_USAGE', 25)],
      options: [optionFixture({ intrRateType: 'M', baseRate: 2.45, maxRate: 3.5 })],
    });
    const rankingInput = input({
      monthlyAmount: 320_000,
      selectedConditions: ['CARD_USAGE'],
    });

    const [row] = buildRanking([compound], rankingInput);
    const option = findRateOption(compound, rankingInput.termMonths, rankingInput.reserveType);
    assert.ok(option);
    const myRateResult = calculateMyRate(compound, option, rankingInput.selectedConditions);
    const expected = calculateInterest({
      monthlyDeposit: rankingInput.monthlyAmount,
      months: rankingInput.termMonths,
      annualRate: myRateResult.myRateBp / 10000,
      interestType: option.intrRateType,
    });

    assert.equal(row.myRate, myRateResult.myRate);
    assert.equal(row.afterTaxInterest, expected.afterTaxInterest);
    assert.deepEqual(row.interest, expected);
  });

  it('keeps real row values aligned with the lower-level calculators', () => {
    const selected: CheckableConditionCode[] = ['NON_FACE_TO_FACE', 'MARKETING_AGREE'];
    const rankingInput = input({
      monthlyAmount: 500_000,
      termMonths: 24,
      reserveType: 'S',
      selectedConditions: selected,
    });
    const rows = buildRanking(products, rankingInput);

    assert.ok(rows.length > 0);

    for (const row of rows) {
      const product = products.find((item) => item.finPrdtCd === row.finPrdtCd);
      assert.ok(product);
      const option = findRateOption(product, rankingInput.termMonths, rankingInput.reserveType);
      assert.ok(option);
      const myRateResult = calculateMyRate(product, option, selected);
      const interest = calculateInterest({
        monthlyDeposit: rankingInput.monthlyAmount,
        months: rankingInput.termMonths,
        annualRate: myRateResult.myRateBp / 10000,
        interestType: option.intrRateType,
      });

      assert.equal(row.companyName, product.companyName);
      assert.equal(row.productName, product.productName);
      assert.equal(row.maxRate, option.maxRate);
      assert.equal(row.myRate, myRateResult.myRate);
      assert.equal(row.afterTaxInterest, interest.afterTaxInterest);
    }
  });
});
