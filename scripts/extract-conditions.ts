// AI 추출 파이프라인 — 배치 1 (빌드 타임)
// 근거: REALRATE_기능명세서.md §8.1, docs/github-issues/09-ai-extraction-pipeline.md
//
// data/raw/savings.json 의 spcl_cnd 원문을 Claude API로 정형 SpecialCondition[]로 추출해
// data/raw/extracted.json 에 저장한다. 검증(§8.2)과 data/products.json 조립은
// scripts/build-products.ts 가 별도로 수행한다 — "추출"과 "검증"의 책임을 분리하기 위함.
//
// 실행: ANTHROPIC_API_KEY=... npx tsx scripts/extract-conditions.ts

import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { pickRepresentativeOption } from './lib/pipeline.js';
import type { RateOption, RawExtraction, SpecialCondition } from './lib/types.js';
import { CONDITION_CODES } from './lib/types.js';

const RAW_PATH = 'data/raw/savings.json';
const OUT_PATH = 'data/raw/extracted.json';

// 스펙: 정확도 우선 claude-opus-5, 대량 처리 시 claude-sonnet-5.
// 이번 배치는 43건 규모라 정확도 우선 모델을 기본값으로 둔다.
const MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL ?? 'claude-opus-5';

const CONDITION_SCHEMA = {
  type: 'object',
  properties: {
    conditions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: 'string', enum: CONDITION_CODES },
          label: { type: 'string' },
          rateBp: { type: 'integer' },
          evidence: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'low'] },
        },
        required: ['code', 'label', 'rateBp', 'evidence', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['conditions'],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `너는 한국 적금 상품의 우대금리 공시 원문(spcl_cnd)을 정형 데이터로 추출하는 전문가다.

표준 우대조건 코드 8종 + 기타:
- SALARY_TRANSFER: 급여/연금 이체
- CARD_USAGE: 카드(신용/체크) 실적
- AUTO_TRANSFER: 공과금/통신비 등 자동이체
- FIRST_CUSTOMER: 첫 거래, 신규 고객
- MARKETING_AGREE: 마케팅 정보 수신 동의
- NON_FACE_TO_FACE: 비대면(인터넷/모바일) 가입
- LINKED_PRODUCT: 청약/펀드/연금 등 다른 상품 보유
- APP_MISSION: 앱 출석, 미션, 이벤트 참여
- OTHER: 위 8종에 해당하지 않거나(예: 목표금액 달성, 추천인, 랜덤 쿠폰, 조건 불명확) 개인이 통제하기 어려운 조건

규칙:
1. 각 우대조건 항목마다 하나의 SpecialCondition을 만든다. 서로 독립적으로 동시에 충족 가능한(합산되는) 조건들만 별도 항목으로 분리한다.
2. **상호배타적 대안(택1) 처리가 가장 중요하다.** "①/② 중복 적용 불가", "①②③ 중 택1", 또는 명시적 문구가 없어도 구조상 한 고객이 동시에 둘 다 해당될 수 없는 대안들(예: 서로 다른 고객군별 요율, 서로 다른 나이대 구간, 하위 요건과 그 요건을 포함하는 상위 요건)은 **가장 우대폭이 큰 대안 하나만 SpecialCondition으로 만들고 나머지는 만들지 마라.** 이런 대안들을 각각 별도 항목으로 나눠 전부 합산하면 안 된다 — 실제로 받을 수 있는 최대 우대폭을 초과하게 되는 가장 흔한 오류다.
3. rateBp는 basis point 정수다 (0.5%p = 50, 1%p = 100). 우대폭이 만기별로 다르면 입력으로 주어진 "최고우대금리" 기준 만기의 값을 쓴다. **개별 조건별 우대폭을 원문에서 전혀 특정할 수 없고 총량 상한(예: "최고 N%p")만 적혀 있는 경우, 그 상한값을 rateBp에 채우지 말고 반드시 0으로 두고 OTHER로 분류한다.** rateBp는 "이 조건 하나에 대해 원문이 명시한 실제 우대폭"일 때만 0이 아니어야 한다.
4. label은 사용자에게 보여줄 한국어 짧은 설명(10~20자 내외)이다.
5. confidence는 'high'(조건과 우대폭이 원문에 명확히 대응) 또는 'low'(추론이 필요하거나 모호함) 중 하나.
6. 공시 원문이 "해당없음", "없음" 등으로 우대조건이 없으면 conditions는 빈 배열이다.
7. JSON 스키마를 따르는 것 외의 텍스트를 출력하지 마라.`;

function buildUserPrompt(params: {
  companyName: string;
  productName: string;
  baseRate: number;
  maxRate: number;
  rawSpecialCondition: string;
}): string {
  return `은행: ${params.companyName}
상품명: ${params.productName}
기본금리: 연 ${params.baseRate}%
최고우대금리: 연 ${params.maxRate}%
(우대갭: ${(params.maxRate - params.baseRate).toFixed(2)}%p)

우대조건 원문(spcl_cnd):
"""
${params.rawSpecialCondition}
"""`;
}

async function extractOne(
  client: Anthropic,
  params: Parameters<typeof buildUserPrompt>[0],
): Promise<{ conditions: SpecialCondition[] } | { failed: true; reason: string }> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: buildUserPrompt(params) }],
        output_config: { format: { type: 'json_schema', schema: CONDITION_SCHEMA } },
      });

      const parsed = response.parsed_output as { conditions: SpecialCondition[] } | null;
      if (parsed == null) {
        if (attempt === 1) continue; // 1회 재시도
        return { failed: true, reason: 'parsed_output이 없음 (재시도 후에도 실패)' };
      }
      return { conditions: parsed.conditions };
    } catch (err) {
      if (attempt === 1) continue; // JSON 파싱/요청 실패 시 1회 재시도
      return { failed: true, reason: err instanceof Error ? err.message : String(err) };
    }
  }
  return { failed: true, reason: '알 수 없는 오류' };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY가 설정되어 있지 않습니다. .env에 추가하거나 환경변수로 전달하세요.');
    process.exit(1);
  }

  const raw = JSON.parse(await readFile(RAW_PATH, 'utf-8')) as {
    baseList: any[];
    optionList: any[];
  };

  // 현재 유효한 공시만 대상으로 한다 (dcls_end_day가 있으면 이미 종료/교체된 공시).
  const activeBase = raw.baseList.filter((b) => !b.dcls_end_day);

  const optionsByKey = new Map<string, any[]>();
  for (const o of raw.optionList) {
    const key = `${o.fin_co_no}::${o.fin_prdt_cd}`;
    const list = optionsByKey.get(key) ?? [];
    list.push(o);
    optionsByKey.set(key, list);
  }

  const client = new Anthropic();
  const results: RawExtraction[] = [];

  console.log(`추출 대상 ${activeBase.length}건, 모델: ${MODEL}`);

  for (const [i, b] of activeBase.entries()) {
    const key = `${b.fin_co_no}::${b.fin_prdt_cd}`;
    const rawOptions = optionsByKey.get(key) ?? [];
    if (rawOptions.length === 0) {
      console.warn(`[${i + 1}/${activeBase.length}] ${b.fin_prdt_nm}: 옵션 없음, 건너뜀`);
      continue;
    }
    const options: RateOption[] = rawOptions.map((o) => ({
      saveTrm: Number(o.save_trm),
      intrRateType: o.intr_rate_type,
      rsrvType: o.rsrv_type,
      baseRate: o.intr_rate,
      maxRate: o.intr_rate2,
    }));
    const rep = pickRepresentativeOption(options);

    const spcl = (b.spcl_cnd ?? '').trim();
    if (!spcl || spcl === '해당없음' || spcl === '없음') {
      results.push({ finCoNo: b.fin_co_no, finPrdtCd: b.fin_prdt_cd, conditions: [] });
      console.log(`[${i + 1}/${activeBase.length}] ${b.fin_prdt_nm}: 우대조건 없음`);
      continue;
    }

    const outcome = await extractOne(client, {
      companyName: b.kor_co_nm,
      productName: b.fin_prdt_nm,
      baseRate: rep.baseRate,
      maxRate: rep.maxRate,
      rawSpecialCondition: b.spcl_cnd,
    });

    if ('failed' in outcome) {
      console.error(`[${i + 1}/${activeBase.length}] ${b.fin_prdt_nm}: 추출 실패 — ${outcome.reason}`);
      results.push({
        finCoNo: b.fin_co_no,
        finPrdtCd: b.fin_prdt_cd,
        conditions: [],
        failed: true,
        failureReason: outcome.reason,
      });
      continue;
    }

    console.log(`[${i + 1}/${activeBase.length}] ${b.fin_prdt_nm}: 조건 ${outcome.conditions.length}건 추출`);
    results.push({ finCoNo: b.fin_co_no, finPrdtCd: b.fin_prdt_cd, conditions: outcome.conditions });
  }

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`저장 완료: ${OUT_PATH} (${results.length}건)`);

  const failedCount = results.filter((r) => r.failed).length;
  if (failedCount > 0) {
    console.warn(`⚠ ${failedCount}건은 자동 추출 실패 — 수동 처리 큐로 분류됨. build-products.ts 실행 전 확인 필요.`);
  }
}

main().catch((err) => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
