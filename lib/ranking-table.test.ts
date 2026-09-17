import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createElement, isValidElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { RankingTable } from '@/app/_components/ranking-table';
import { TopProductCard } from '@/app/_components/top-product-card';
import { DEFAULT_CALC_INPUT, setProductConditionOverride, type BankScopedConditionCode } from './calc-input';
import { buildRanking } from './ranking';
import type { Product, SpecialCondition } from './types';

const condition = (code: SpecialCondition['code'], rateBp = 200): SpecialCondition => ({
  code, label: code, rateBp, evidence: `${code} 근거`, confidence: 'high',
});
const product = (id: string, bank: string, baseRate: number, conditions: SpecialCondition[]): Product => ({
  finPrdtCd: id, companyName: bank, productName: `${id}적금`, joinWay: '',
  rawSpecialCondition: '', conditions, disclosureMonth: '2026-09', unexplainedBp: 0, reviewed: true,
  options: [{ saveTrm: 12, intrRateType: 'S', rsrvType: 'S', baseRate, maxRate: 8 }],
});
const products = [
  product('A', 'A은행', 4, []),
  product('B', 'B은행', 3, [condition('SALARY_TRANSFER'), condition('CARD_USAGE', 20), condition('AUTO_TRANSFER')]),
  product('C', 'B은행', 2, [condition('SALARY_TRANSFER')]),
  product('D', 'D은행', 1, [condition('FIRST_CUSTOMER')]),
];

// Resolve these hook-free presentation components to exercise their actual input handlers.
function inputs(node: ReactNode): Array<{ onChange: () => void }> {
  if (Array.isArray(node)) return node.flatMap(inputs);
  if (!isValidElement<{ children?: ReactNode; onChange?: () => void }>(node)) return [];
  if (typeof node.type === 'function') {
    return inputs((node.type as (props: unknown) => ReactNode)(node.props));
  }
  if (node.type === 'input' && node.props.onChange) return [{ onChange: node.props.onChange }];
  return inputs(node.props.children);
}

const render = (rows = buildRanking(products, DEFAULT_CALC_INPUT)) => renderToStaticMarkup(
  createElement(RankingTable, { rows, onConditionConfirm: () => {} }),
);

describe('RankingTable condition confirmation', () => {
  it('renders counts and native disclosure rows inside tbody only for unconfirmed products', () => {
    const markup = render();
    assert.equal(markup.match(/미확인 2/g)?.length, 1);
    assert.equal(markup.match(/미확인 1/g)?.length, 2);
    assert.doesNotMatch(markup, /미확인 0/);
    assert.equal(markup.match(/<details/g)?.length, 3);
    assert.match(markup, /<tbody[^>]*>.*<tr><td colSpan="6"[^>]*><details.*<summary[^>]*aria-label="B은행 B적금 12개월 정액적립식 조건 확인"/);
    assert.doesNotMatch(markup, /<details[^>]* open/);
    for (const label of ['충족 O', '미확인 ?', '미충족 X']) assert.ok(markup.includes(label));
    assert.equal(markup.match(/type="checkbox"/g)?.length, 4);
    assert.doesNotMatch(markup, /AUTO_TRANSFER 확인/);
    assert.match(render([]), /선택한 기간에 해당하는 상품이 없습니다/);
  });

  it('confirms a lower-ranked product through its checkbox and changes the leader without changing peers', () => {
    let input = DEFAULT_CALC_INPUT;
    const calls: Array<[string, BankScopedConditionCode]> = [];
    const onConditionConfirm = (id: string, code: BankScopedConditionCode) => {
      calls.push([id, code]);
      input = setProductConditionOverride(input, id, code);
    };
    const before = buildRanking(products, input);
    const tree = RankingTable({ rows: before, onConditionConfirm });
    inputs(tree)[0].onChange();
    assert.deepEqual(calls, [['B', 'SALARY_TRANSFER']]);
    assert.deepEqual(input.productConditionOverrides, { B: { SALARY_TRANSFER: true } });
    assert.deepEqual(DEFAULT_CALC_INPUT.productConditionOverrides, {});
    const after = buildRanking(products, input);
    assert.equal(before[1].finPrdtCd, 'B');
    assert.equal(after[0].finPrdtCd, 'B');
    assert.equal(after[0].myRate, 5);
    for (const id of ['A', 'C', 'D']) {
      const old = before.find((row) => row.finPrdtCd === id)!;
      const next = after.find((row) => row.finPrdtCd === id)!;
      assert.deepEqual(next.myRateResult, old.myRateResult);
      assert.equal(next.afterTaxInterest, old.afterTaxInterest);
    }
    assert.match(render(after), /B적금.*미확인 1/);
    const card = renderToStaticMarkup(createElement(TopProductCard, { rankingRows: after, onConditionConfirm }));
    assert.match(card, /id="top-product-heading"[^>]*>B적금/);
    assert.match(card, /5\.00%/);
    inputs(RankingTable({ rows: after, onConditionConfirm }))[0].onChange();
    assert.deepEqual(calls[1], ['B', 'CARD_USAGE']);
    assert.doesNotMatch(render(buildRanking(products, input)), /aria-label="B은행 B적금/);
  });
});
