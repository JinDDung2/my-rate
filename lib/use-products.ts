'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProductsResponse } from '@/lib/types';

export type ProductsState =
  | { status: 'loading'; data: null; error: null; reload: () => void }
  | { status: 'success'; data: ProductsResponse; error: null; reload: () => void }
  | { status: 'error'; data: null; error: Error; reload: () => void };

type ProductsLoadState =
  | { status: 'loading'; data: null; error: null }
  | { status: 'success'; data: ProductsResponse; error: null }
  | { status: 'error'; data: null; error: Error };

export function useProducts(): ProductsState {
  const [state, setState] = useState<ProductsLoadState>({
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
        const response = await fetch('/api/products', {
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
