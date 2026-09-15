import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEFAULT_CALC_INPUT,
  type CalcInput,
} from './calc-input';
import {
  buildShareUrl,
  hasCalcInputQueryKeys,
  parseCalcInputFromQuery,
  serializeCalcInput,
} from './share-url';

const input: CalcInput = {
  ...DEFAULT_CALC_INPUT,
  monthlyAmount: 300_000,
  termMonths: 24,
  reserveType: 'F',
  selectedConditions: ['MARKETING_AGREE', 'AUTO_TRANSFER'],
};

describe('calc input share URL serialization', () => {
  it('serializes with deterministic key and condition order', () => {
    assert.equal(
      serializeCalcInput(input),
      'm=300000&t=24&r=F&c=AUTO_TRANSFER,MARKETING_AGREE',
    );

    assert.equal(
      serializeCalcInput({
        ...input,
        selectedConditions: ['MARKETING_AGREE', 'AUTO_TRANSFER'],
      }),
      serializeCalcInput({
        ...input,
        selectedConditions: ['AUTO_TRANSFER', 'MARKETING_AGREE'],
      }),
    );
  });

  it('omits c when no conditions are selected', () => {
    assert.equal(
      serializeCalcInput({
        ...input,
        selectedConditions: [],
      }),
      'm=300000&t=24&r=F',
    );
  });

  it('round-trips through the parser', () => {
    const normalizedInput: CalcInput = {
      ...input,
      selectedConditions: ['AUTO_TRANSFER', 'MARKETING_AGREE'],
    };

    assert.deepEqual(parseCalcInputFromQuery(serializeCalcInput(input)), normalizedInput);
  });

  it('builds a fresh absolute URL and drops existing search or hash', () => {
    assert.equal(
      buildShareUrl({ origin: 'https://example.com', pathname: '/rates' }, input),
      'https://example.com/rates?m=300000&t=24&r=F&c=AUTO_TRANSFER,MARKETING_AGREE',
    );
  });
});

describe('calc input share URL parsing', () => {
  it('returns defaults for an empty query or blank values', () => {
    assert.deepEqual(parseCalcInputFromQuery(''), DEFAULT_CALC_INPUT);
    assert.deepEqual(parseCalcInputFromQuery('?utm_source=x'), DEFAULT_CALC_INPUT);
    assert.deepEqual(parseCalcInputFromQuery('?m=&t=&r=&c='), DEFAULT_CALC_INPUT);
  });

  it('defaults invalid monthly amounts', () => {
    assert.equal(parseCalcInputFromQuery('?m=abc').monthlyAmount, 500_000);
  });

  it('snaps and clamps monthly amounts', () => {
    assert.equal(parseCalcInputFromQuery('?m=-100').monthlyAmount, 10_000);
    assert.equal(parseCalcInputFromQuery('?m=15000').monthlyAmount, 20_000);
    assert.equal(parseCalcInputFromQuery('?m=7000').monthlyAmount, 10_000);
    assert.equal(parseCalcInputFromQuery('?m=99999999').monthlyAmount, 1_000_000);
  });

  it('defaults unsupported term and reserve values', () => {
    assert.equal(parseCalcInputFromQuery('?t=9').termMonths, DEFAULT_CALC_INPUT.termMonths);
    assert.equal(parseCalcInputFromQuery('?t=twelve').termMonths, DEFAULT_CALC_INPUT.termMonths);
    assert.equal(parseCalcInputFromQuery('?r=X').reserveType, DEFAULT_CALC_INPUT.reserveType);
  });

  it('filters unknown conditions, OTHER, lowercase, blanks, and duplicates', () => {
    assert.deepEqual(
      parseCalcInputFromQuery(
        '?c=FOO,AUTO_TRANSFER,salary_transfer,OTHER,,MARKETING_AGREE,MARKETING_AGREE',
      ).selectedConditions,
      ['AUTO_TRANSFER', 'MARKETING_AGREE'],
    );
  });

  it('falls back field-by-field and preserves other valid fields', () => {
    assert.deepEqual(parseCalcInputFromQuery('?m=abc&t=24&r=F'), {
      ...DEFAULT_CALC_INPUT,
      monthlyAmount: 500_000,
      termMonths: 24,
      reserveType: 'F',
      selectedConditions: [],
    });

    assert.deepEqual(parseCalcInputFromQuery('?t=36&c=MARKETING_AGREE%2CAUTO_TRANSFER'), {
      ...DEFAULT_CALC_INPUT,
      monthlyAmount: 500_000,
      termMonths: 36,
      reserveType: 'S',
      selectedConditions: ['AUTO_TRANSFER', 'MARKETING_AGREE'],
    });
  });

  it('detects whether a query has calc input keys', () => {
    assert.equal(hasCalcInputQueryKeys('?utm_source=x'), false);
    assert.equal(hasCalcInputQueryKeys('?utm_source=x&m=300000'), true);
  });
});

describe('bank selection sharing', () => {
  it('round-trips bank names but leaves product confirmations in the session', () => {
    const input: CalcInput = {
      ...DEFAULT_CALC_INPUT,
      salaryTransferBank: '농협은행주식회사',
      cardUsageBank: '주식회사 하나은행',
      productConditionOverrides: { product: { FIRST_CUSTOMER: true } },
    };
    const query = serializeCalcInput(input);
    assert.deepEqual(parseCalcInputFromQuery(query), { ...input, productConditionOverrides: {} });
    assert.doesNotMatch(query, /FIRST_CUSTOMER|product/);
    assert.equal(hasCalcInputQueryKeys('?sb=국민은행'), true);
    assert.equal(hasCalcInputQueryKeys('?cb=우리은행'), true);
  });

  it('ignores legacy global bank-scoped flags without assuming a bank', () => {
    const parsed = parseCalcInputFromQuery('?c=SALARY_TRANSFER,CARD_USAGE,FIRST_CUSTOMER,AUTO_TRANSFER');
    assert.deepEqual(parsed, { ...DEFAULT_CALC_INPUT, selectedConditions: ['AUTO_TRANSFER'] });
  });
});
