'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProductsResponse } from '@/lib/types';

type ProductsState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: ProductsResponse; error: null }
  | { status: 'error'; data: null; error: Error };

export function useProducts() {
  const [state, setState] = useState<ProductsState>({
    status: 'loading',
    data: null,
    error: null,
  });
  const [requestId, setRequestId] = useState(0);

  const reload = useCallback(() => {
    setRequestId((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setState({ status: 'loading', data: null, error: null });

      try {
        const forceInitialError =
          process.env.NODE_ENV !== 'production' &&
          requestId === 0 &&
          new URLSearchParams(window.location.search).get('forceError') === '1';
        const endpoint = forceInitialError ? '/api/products?forceError=1' : '/api/products';
        const response = await fetch(endpoint, {
          signal: controller.signal,
          cache: 'no-store',
        });

        if (!response.ok) {
          throw new Error(`Products request failed: ${response.status}`);
        }

        const data = (await response.json()) as ProductsResponse;
        setState({ status: 'success', data, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          status: 'error',
          data: null,
          error: error instanceof Error ? error : new Error('Unknown products request failure'),
        });
      }
    }

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, [requestId]);

  return { ...state, reload };
}
