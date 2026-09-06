'use client';

import { useEffect, useRef, useState } from 'react';
import type { CalcInput } from '@/lib/calc-input';
import { buildShareUrl } from '@/lib/share-url';

interface ShareButtonProps {
  input: CalcInput;
}

type ShareState = 'idle' | 'copied' | 'fallback';

const COPIED_VISIBLE_MS = 3000;

export function ShareButton({ input }: ShareButtonProps) {
  const [state, setState] = useState<ShareState>('idle');
  const [shareUrl, setShareUrl] = useState('');
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    const nextShareUrl = buildShareUrl(window.location, input);
    setShareUrl(nextShareUrl);

    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API is unavailable');
      }

      await navigator.clipboard.writeText(nextShareUrl);
      setState('copied');
      timeoutRef.current = window.setTimeout(() => {
        setState('idle');
        timeoutRef.current = null;
      }, COPIED_VISIBLE_MS);
    } catch {
      setState('fallback');
    }
  }

  return (
    <div className="border-t border-slate-200 pt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">결과 공유</p>
          <p className="mt-1 text-sm text-slate-600">현재 입력 상태를 담은 링크를 복사합니다.</p>
        </div>
        <button
          className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
          onClick={handleCopy}
          type="button"
        >
          공유 링크 복사
        </button>
      </div>

      <div aria-live="polite" className="mt-3 text-sm">
        {state === 'copied' ? (
          <p className="font-medium text-emerald-700">공유 링크를 복사했어요.</p>
        ) : null}
        {state === 'fallback' ? (
          <div className="grid gap-2">
            <p className="font-medium text-red-700">복사 실패, 아래 링크를 직접 복사하세요.</p>
            <input
              className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              onFocus={(event) => event.target.select()}
              readOnly
              type="text"
              value={shareUrl}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
