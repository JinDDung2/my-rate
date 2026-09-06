import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ActionListCard } from '@/app/_components/action-list-card';
import type { CalcInput } from './calc-input';
import { DEFAULT_CALC_INPUT } from './calc-input';
import { buildRanking, type RankingRow } from './ranking';
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

function productFixture(overrides: Partial<Product> = {}): Product {
  const option = optionFixture();

  return {
    finPrdtCd: 'fixture',
    companyName: 'fixture bank',
    productName: 'fixture product',
    joinWay: 'online',
    rawSpecialCondition: 'fixture',
    conditions: [],
    options: [option],
    disclosureMonth: '202608',
    unexplainedBp: 0,
    reviewed: true,
    ...overrides,
  };
}

function render(rankingRows: RankingRow[], products: Product[], calcInput: CalcInput): string {
  return renderToStaticMarkup(
    createElement(ActionListCard, {
      rankingRows,
      products,
      input: calcInput,
    }),
  );
}

describe('ActionListCard', () => {
  it('renders sorted action rows with plus-prefixed, thousands-formatted won amounts', () => {
    const calcInput = input({ monthlyAmount: 500_000 });
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 10),
        condition('CARD_USAGE', 50),
        condition('AUTO_TRANSFER', 20),
        condition('FIRST_CUSTOMER', 40),
      ],
    });
    const rankingRows = buildRanking([product], calcInput);

    const markup = render(rankingRows, [product], calcInput);

    assert.match(markup, /aria-labelledby="action-list-heading"/);
    assert.match(markup, /\[D\] 액션 리스트/);
    assert.match(markup, /카드 실적를 추가하면/);
    assert.match(markup, /\+13,748원/);
    assert.match(markup, /첫 거래를 추가하면/);
    assert.match(markup, /\+10,998원/);
    assert.match(markup, /자동이체를 추가하면/);
    assert.match(markup, /\+5,499원/);
    assert.doesNotMatch(markup, /급여이체를 추가하면/);
    assert.ok(markup.indexOf('카드 실적를 추가하면') < markup.indexOf('첫 거래를 추가하면'));
    assert.ok(markup.indexOf('첫 거래를 추가하면') < markup.indexOf('자동이체를 추가하면'));
  });

  it('renders at most 3 action rows even when more candidates exist', () => {
    const calcInput = input();
    const product = productFixture({
      conditions: [
        condition('SALARY_TRANSFER', 10),
        condition('CARD_USAGE', 50),
        condition('AUTO_TRANSFER', 20),
        condition('FIRST_CUSTOMER', 40),
        condition('MARKETING_AGREE', 30),
      ],
    });
    const markup = render(buildRanking([product], calcInput), [product], calcInput);

    assert.equal(markup.match(/를 추가하면/g)?.length, 3);
  });

  it('renders nothing for empty rankings, missing products, and fully satisfied conditions', () => {
    const calcInput = input();
    const product = productFixture({
      conditions: [condition('SALARY_TRANSFER', 10)],
    });
    const rankingRows = buildRanking([product], calcInput);

    assert.equal(render([], [product], calcInput), '');
    assert.equal(render(rankingRows, [], calcInput), '');
    assert.equal(
      render(
        buildRanking([product], input({ selectedConditions: ['SALARY_TRANSFER'] })),
        [product],
        input({ selectedConditions: ['SALARY_TRANSFER'] }),
      ),
      '',
    );
  });
});
