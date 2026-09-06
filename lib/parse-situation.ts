import { CONDITION_CODES, type ConditionCode } from '@/lib/types';

export const PARSE_SITUATION_TEXT_MAX_LENGTH = 280;
export const PARSE_SITUATION_SUMMARY_MAX_LENGTH = 200;

export interface ParseSituationRequest {
  text: string;
}

export interface ParseSituationResponse {
  conditions: ConditionCode[];
  summary: string;
}

export type SituationLlmCaller = (text: string, options?: { signal?: AbortSignal }) => Promise<unknown>;

export type SituationTextValidationResult =
  | { ok: true; text: string }
  | { ok: false; error: 'invalid_text' | 'text_too_long' };

export type ParseSituationResult =
  | { ok: true; value: ParseSituationResponse }
  | { ok: false; error: 'invalid_output' | 'upstream_error' | 'timeout' };

const CONDITION_CODE_SET = new Set<ConditionCode>(CONDITION_CODES);

export const PARSE_SITUATION_SYSTEM_PROMPT = `너는 사용자의 한국 적금 우대조건 상황 설명을 표준 조건 코드로 매핑하는 도우미다.

표준 우대조건 코드 8종 + 기타:
- SALARY_TRANSFER: 급여/연금 이체
- CARD_USAGE: 카드(신용/체크) 실적
- AUTO_TRANSFER: 공과금/통신비 등 자동이체
- FIRST_CUSTOMER: 첫 거래, 신규 고객
- MARKETING_AGREE: 마케팅 정보 수신 동의
- NON_FACE_TO_FACE: 비대면(인터넷/모바일) 가입
- LINKED_PRODUCT: 청약/펀드/연금 등 다른 상품 보유
- APP_MISSION: 앱 출석, 미션, 이벤트 참여
- OTHER: 위 8종에 해당하지 않거나 판단할 수 없는 내용

규칙:
1. 사용자가 직접 말한 상황에서 합리적으로 추론되는 코드만 conditions에 담아라.
2. 조건이 전혀 없거나 알 수 없으면 conditions는 빈 배열이다.
3. summary는 사용자의 상황을 한국어 한 문장으로 짧게 요약한다.
4. JSON 스키마를 따르는 것 외의 텍스트를 출력하지 마라.`;

export function validateSituationText(value: unknown): SituationTextValidationResult {
  if (typeof value !== 'string') {
    return { ok: false, error: 'invalid_text' };
  }

  const text = value.trim();
  if (text.length === 0) {
    return { ok: false, error: 'invalid_text' };
  }

  if (text.length > PARSE_SITUATION_TEXT_MAX_LENGTH) {
    return { ok: false, error: 'text_too_long' };
  }

  return { ok: true, text };
}

export function normalizeSituationOutput(output: unknown): ParseSituationResponse | null {
  if (output == null || typeof output !== 'object') {
    return null;
  }

  const record = output as Record<string, unknown>;
  if (!Array.isArray(record.conditions)) {
    return null;
  }

  const conditionSet = new Set<ConditionCode>();
  for (const value of record.conditions) {
    if (typeof value !== 'string') continue;
    if (!CONDITION_CODE_SET.has(value as ConditionCode)) continue;
    conditionSet.add(value as ConditionCode);
  }

  const summary =
    typeof record.summary === 'string'
      ? record.summary.trim().slice(0, PARSE_SITUATION_SUMMARY_MAX_LENGTH)
      : '';

  return {
    conditions: CONDITION_CODES.filter((code) => conditionSet.has(code)),
    summary,
  };
}

export async function parseSituation(
  text: string,
  callLlm: SituationLlmCaller,
  options: { signal?: AbortSignal } = {},
): Promise<ParseSituationResult> {
  try {
    const output = await callLlm(text, options);
    const normalized = normalizeSituationOutput(output);
    if (normalized == null) {
      return { ok: false, error: 'invalid_output' };
    }

    return { ok: true, value: normalized };
  } catch (error) {
    if (isTimeoutError(error)) {
      return { ok: false, error: 'timeout' };
    }

    return { ok: false, error: 'upstream_error' };
  }
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || error.name === 'TimeoutError';
}
