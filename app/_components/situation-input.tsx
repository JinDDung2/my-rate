'use client';

import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { CHECKABLE_CONDITION_CODES } from '@/lib/conditions';
import type { CheckableConditionCode } from '@/lib/calc-input';
import type { ParseSituationResponse } from '@/lib/parse-situation';

interface SituationInputProps {
  onConditionsParsed: (codes: CheckableConditionCode[]) => void;
}

type SubmitState =
  | { status: 'idle'; summary: string | null }
  | { status: 'loading'; summary: string | null }
  | { status: 'success'; summary: string }
  | { status: 'error'; summary: string | null };

const CLIENT_TIMEOUT_MS = 6000;
const TOAST_VISIBLE_MS = 4000;

export function SituationInput({ onConditionsParsed }: SituationInputProps) {
  const [text, setText] = useState('');
  const [state, setState] = useState<SubmitState>({ status: 'idle', summary: null });
  const [showErrorToast, setShowErrorToast] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!showErrorToast) return;

    const timeoutId = window.setTimeout(() => {
      setShowErrorToast(false);
    }, TOAST_VISIBLE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showErrorToast]);

  useEffect(() => {
    return () => {
      requestRef.current?.abort();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedText = text.trim();
    if (!trimmedText) return;

    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, CLIENT_TIMEOUT_MS);

    setState({ status: 'loading', summary: null });

    try {
      const response = await fetch('/api/parse-situation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: trimmedText }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Situation parse failed: ${response.status}`);
      }

      const data = (await response.json()) as ParseSituationResponse;
      const checkableConditions = CHECKABLE_CONDITION_CODES.filter((code) =>
        data.conditions.includes(code),
      );

      onConditionsParsed(checkableConditions);
      setState({ status: 'success', summary: data.summary });
      setShowErrorToast(false);
    } catch {
      setState({ status: 'error', summary: null });
      setShowErrorToast(true);
    } finally {
      window.clearTimeout(timeoutId);
      if (requestRef.current === controller) {
        requestRef.current = null;
      }
    }
  }

  const isLoading = state.status === 'loading';

  return (
    <div className="border-b border-slate-200 pb-6">
      <form className="grid gap-3" onSubmit={handleSubmit}>
        <label className="text-sm font-semibold text-slate-900" htmlFor="situation-text">
          자연어로 입력하기
        </label>
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
          disabled={isLoading}
          id="situation-text"
          maxLength={280}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          value={text}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{text.trim().length}/280</span>
          <button
            className="h-10 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={isLoading || text.trim().length === 0}
            type="submit"
          >
            {isLoading ? '분석 중' : '조건 찾기'}
          </button>
        </div>
      </form>

      {state.summary ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-sm font-semibold text-emerald-950">AI가 이렇게 이해했어요</p>
          <p className="mt-1 text-sm text-emerald-900">{state.summary}</p>
        </div>
      ) : null}

      {showErrorToast ? (
        <div
          className="mt-4 flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-800"
          role="alert"
        >
          <span>자연어 입력을 적용하지 못했어요. 아래 조건을 직접 선택해 주세요.</span>
          <button
            aria-label="알림 닫기"
            className="shrink-0 text-red-900 underline underline-offset-2"
            onClick={() => setShowErrorToast(false)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}
