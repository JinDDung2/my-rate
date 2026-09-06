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
  monthlyAmount: 300_000,
  termMonths: 24,
  reserveType: 'F',
  selectedConditions: ['CARD_USAGE', 'SALARY_TRANSFER'],
};

describe('calc input share URL serialization', () => {
  it('serializes with deterministic key and condition order', () => {
    assert.equal(
      serializeCalcInput(input),
      'm=300000&t=24&r=F&c=SALARY_TRANSFER,CARD_USAGE',
    );

    assert.equal(
      serializeCalcInput({
        ...input,
        selectedConditions: ['CARD_USAGE', 'SALARY_TRANSFER'],
      }),
      serializeCalcInput({
        ...input,
        selectedConditions: ['SALARY_TRANSFER', 'CARD_USAGE'],
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
      selectedConditions: ['SALARY_TRANSFER', 'CARD_USAGE'],
    };

    assert.deepEqual(parseCalcInputFromQuery(serializeCalcInput(input)), normalizedInput);
  });

  it('builds a fresh absolute URL and drops existing search or hash', () => {
    assert.equal(
      buildShareUrl({ origin: 'https://example.com', pathname: '/rates' }, input),
      'https://example.com/rates?m=300000&t=24&r=F&c=SALARY_TRANSFER,CARD_USAGE',
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
        '?c=FOO,SALARY_TRANSFER,salary_transfer,OTHER,,CARD_USAGE,CARD_USAGE',
      ).selectedConditions,
      ['SALARY_TRANSFER', 'CARD_USAGE'],
    );
  });

  it('falls back field-by-field and preserves other valid fields', () => {
    assert.deepEqual(parseCalcInputFromQuery('?m=abc&t=24&r=F'), {
      monthlyAmount: 500_000,
      termMonths: 24,
      reserveType: 'F',
      selectedConditions: [],
    });

    assert.deepEqual(parseCalcInputFromQuery('?t=36&c=CARD_USAGE%2CSALARY_TRANSFER'), {
      monthlyAmount: 500_000,
      termMonths: 36,
      reserveType: 'S',
      selectedConditions: ['SALARY_TRANSFER', 'CARD_USAGE'],
    });
  });

  it('detects whether a query has calc input keys', () => {
    assert.equal(hasCalcInputQueryKeys('?utm_source=x'), false);
    assert.equal(hasCalcInputQueryKeys('?utm_source=x&m=300000'), true);
  });
});
