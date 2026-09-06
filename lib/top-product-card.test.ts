import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TopProductCard } from '@/app/_components/top-product-card';
import type { RankingRow } from './ranking';
import type { SpecialCondition } from './types';

function condition(
  code: SpecialCondition['code'],
  label: string,
  rateBp: number,
): SpecialCondition {
  return {
    code,
    label,
    rateBp,
    evidence: `${label} evidence`,
    confidence: 'high',
  };
}

function row(overrides: Partial<RankingRow> = {}): RankingRow {
  return {
    rank: 1,
    finPrdtCd: 'MY_LEADER',
    companyName: '테스트은행',
    productName: '테스트적금',
    maxRate: 3.7,
    myRate: 3.6,
    afterTaxInterest: 98_982,
    option: {
      saveTrm: 12,
      intrRateType: 'S',
      rsrvType: 'S',
      baseRate: 3.6,
      maxRate: 3.7,
    },
    myRateResult: {
      myRate: 3.6,
      myRateBp: 360,
      baseRate: 3.6,
      maxRate: 3.7,
      appliedBp: 50,
      clamped: false,
      clampedAwayBp: 0,
      applied: [condition('NON_FACE_TO_FACE', '비대면 가입', 50)],
      unapplied: [condition('SALARY_TRANSFER', '급여 이체', 25)],
      excluded: [condition('OTHER', '기타 조건', 0)],
    },
    interest: {
      principal: 6_000_000,
      pretaxInterest: 116_999,
      tax: 18_017,
      afterTaxInterest: 98_982,
      maturityAmount: 6_098_982,
    },
    ...overrides,
  };
}

function render(rows: RankingRow[]): string {
  return renderToStaticMarkup(createElement(TopProductCard, { rankingRows: rows }));
}

describe('TopProductCard', () => {
  it('renders the after-tax leader values, condition lists, and advertised-leader badge', () => {
    const markup = render([
      row(),
      row({
        rank: 2,
        finPrdtCd: 'AD_LEADER',
        maxRate: 4.1,
        option: {
          saveTrm: 12,
          intrRateType: 'S',
          rsrvType: 'S',
          baseRate: 2.2,
          maxRate: 4.1,
        },
      }),
    ]);

    assert.match(markup, /aria-labelledby="top-product-heading"/);
    assert.match(markup, /테스트적금/);
    assert.match(markup, /광고 최고금리/);
    assert.match(markup, /3\.70%/);
    assert.match(markup, /내 금리/);
    assert.match(markup, /3\.60%/);
    assert.match(markup, /6,000,000원/);
    assert.match(markup, /98,982원/);
    assert.match(markup, /충족 O/);
    assert.match(markup, /비대면 가입/);
    assert.match(markup, /0\.5%p/);
    assert.match(markup, /미충족 X/);
    assert.match(markup, /급여 이체/);
    assert.match(markup, /0\.25%p/);
    assert.match(markup, /광고 1위와 다릅니다/);
    assert.doesNotMatch(markup, /기타 조건/);
  });

  it('renders no badge when the advertised leader matches and uses the empty-list fallback', () => {
    const markup = render([
      row({
        myRateResult: {
          ...row().myRateResult,
          applied: [],
          unapplied: [],
          excluded: [condition('OTHER', '기타 조건', 0)],
        },
      }),
    ]);

    assert.doesNotMatch(markup, /광고 1위와 다릅니다/);
    assert.equal(markup.match(/없음/g)?.length, 2);
    assert.doesNotMatch(markup, /기타 조건/);
  });

  it('renders nothing for an empty ranking', () => {
    assert.equal(render([]), '');
  });
});
