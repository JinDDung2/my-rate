import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import {
  parseSituation,
  PARSE_SITUATION_SYSTEM_PROMPT,
  validateSituationText,
  type ParseSituationResponse,
} from '@/lib/parse-situation';
import { FixedWindowRateLimiter, getClientIp } from '@/lib/rate-limit';
import { CONDITION_CODES } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.PARSE_SITUATION_MODEL ?? 'claude-sonnet-5';
const TIMEOUT_MS = 5000;

const limiter = new FixedWindowRateLimiter(10, 60_000);

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    conditions: {
      type: 'array',
      items: { type: 'string', enum: CONDITION_CODES },
    },
    summary: { type: 'string' },
  },
  required: ['conditions', 'summary'],
  additionalProperties: false,
} as const;

export async function POST(request: Request) {
  const rateLimit = limiter.check(getClientIp(request.headers));
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const textValidation = validateSituationText((body as { text?: unknown } | null)?.text);
  if (!textValidation.ok) {
    return NextResponse.json({ error: textValidation.error }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'anthropic_api_key_missing' }, { status: 503 });
  }

  const client = new Anthropic({ maxRetries: 0 });
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  const result = await parseSituation(
    textValidation.text,
    async (text, options) => {
      const response = await client.messages.parse(
        {
          model: MODEL,
          max_tokens: 512,
          temperature: 0,
          system: PARSE_SITUATION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: text }],
          output_config: { format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
        },
        {
          signal: options?.signal,
          maxRetries: 0,
        },
      );

      return response.parsed_output;
    },
    { signal },
  );

  if (result.ok) {
    return NextResponse.json(result.value satisfies ParseSituationResponse);
  }

  if (result.error === 'timeout') {
    return NextResponse.json({ error: 'timeout' }, { status: 504 });
  }

  if (result.error === 'invalid_output') {
    return NextResponse.json({ error: 'invalid_llm_output' }, { status: 502 });
  }

  return NextResponse.json({ error: 'upstream_error' }, { status: 502 });
}
