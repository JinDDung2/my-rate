import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { APIConnectionTimeoutError, APIUserAbortError } from '@anthropic-ai/sdk';
import { applyConditions } from './calc-input';
import {
  normalizeSituationOutput,
  parseSituation,
  PARSE_SITUATION_DEFAULT_SUMMARY,
  PARSE_SITUATION_SUMMARY_MAX_LENGTH,
  PARSE_SITUATION_TEXT_MAX_LENGTH,
  validateSituationText,
} from './parse-situation';

describe('situation text validation', () => {
  it('rejects non-string, empty, blank, and over-limit text', () => {
    assert.deepEqual(validateSituationText(null), { ok: false, error: 'invalid_text' });
    assert.deepEqual(validateSituationText(''), { ok: false, error: 'invalid_text' });
    assert.deepEqual(validateSituationText('   \n\t'), { ok: false, error: 'invalid_text' });
    assert.deepEqual(validateSituationText('가'.repeat(PARSE_SITUATION_TEXT_MAX_LENGTH + 1)), {
      ok: false,
      error: 'text_too_long',
    });
  });

  it('trims valid text', () => {
    assert.deepEqual(validateSituationText('  급여 받고 카드도 써요  '), {
      ok: true,
      text: '급여 받고 카드도 써요',
    });
  });
});

describe('situation output normalization', () => {
  it('filters unknown codes, removes duplicates, and sorts by standard order', () => {
    const output = normalizeSituationOutput({
      conditions: [
        'CARD_USAGE',
        'UNKNOWN',
        'SALARY_TRANSFER',
        'CARD_USAGE',
        'OTHER',
        'AUTO_TRANSFER',
      ],
      summary: '급여와 카드 사용, 자동이체가 가능해 보여요.',
    });

    assert.deepEqual(output, {
      conditions: ['SALARY_TRANSFER', 'CARD_USAGE', 'AUTO_TRANSFER', 'OTHER'],
      summary: '급여와 카드 사용, 자동이체가 가능해 보여요.',
    });
  });

  it('clamps summary and falls back when summary is blank or non-string', () => {
    const longSummary = '가'.repeat(PARSE_SITUATION_SUMMARY_MAX_LENGTH + 10);
    assert.equal(
      normalizeSituationOutput({ conditions: [], summary: longSummary })?.summary.length,
      PARSE_SITUATION_SUMMARY_MAX_LENGTH,
    );
    assert.equal(
      normalizeSituationOutput({ conditions: [], summary: 123 })?.summary,
      PARSE_SITUATION_DEFAULT_SUMMARY,
    );
    assert.equal(
      normalizeSituationOutput({ conditions: [], summary: '   ' })?.summary,
      PARSE_SITUATION_DEFAULT_SUMMARY,
    );
  });

  it('rejects missing condition arrays', () => {
    assert.equal(normalizeSituationOutput(null), null);
    assert.equal(normalizeSituationOutput({ summary: '요약' }), null);
  });
});

describe('parse situation orchestration', () => {
  it('returns normalized output from an injected llm caller', async () => {
    const result = await parseSituation('회사에서 이 은행으로 월급 받고 카드도 많이 써요', async () => ({
      conditions: ['CARD_USAGE', 'SALARY_TRANSFER', 'CARD_USAGE'],
      summary: '급여 이체와 카드 사용 조건이 가능해 보여요.',
    }));

    assert.deepEqual(result, {
      ok: true,
      value: {
        conditions: ['SALARY_TRANSFER', 'CARD_USAGE'],
        summary: '급여 이체와 카드 사용 조건이 가능해 보여요.',
      },
    });
  });

  it('returns invalid_output when parsed output is null', async () => {
    const result = await parseSituation('급여이체 해요', async () => null);

    assert.deepEqual(result, { ok: false, error: 'invalid_output' });
  });

  it('returns upstream_error when the llm caller throws', async () => {
    const result = await parseSituation('급여이체 해요', async () => {
      throw new Error('upstream failed');
    });

    assert.deepEqual(result, { ok: false, error: 'upstream_error' });
  });

  it('returns timeout when the llm caller aborts', async () => {
    const result = await parseSituation('급여이체 해요', async () => {
      throw new APIUserAbortError();
    });

    assert.deepEqual(result, { ok: false, error: 'timeout' });
  });

  it('returns timeout when the sdk reports a connection timeout', async () => {
    const result = await parseSituation('급여이체 해요', async () => {
      throw new APIConnectionTimeoutError();
    });

    assert.deepEqual(result, { ok: false, error: 'timeout' });
  });

  it('keeps native abort errors classified as timeout', async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    const result = await parseSituation('급여이체 해요', async () => {
      throw error;
    });

    assert.deepEqual(result, { ok: false, error: 'timeout' });
  });
});

describe('calc input condition union', () => {
  it('preserves existing selections, ignores OTHER, deduplicates, and keeps standard order', () => {
    const result = applyConditions(
      ['APP_MISSION', 'CARD_USAGE'],
      ['OTHER', 'SALARY_TRANSFER', 'CARD_USAGE', 'AUTO_TRANSFER'],
    );

    assert.deepEqual(result, ['SALARY_TRANSFER', 'CARD_USAGE', 'AUTO_TRANSFER', 'APP_MISSION']);
  });
});
