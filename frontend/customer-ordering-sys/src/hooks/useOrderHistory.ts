// ============================================================
// src/hooks/useOrderHistory.ts
// Custom hook that encapsulates all API communication for UC-8.
// Identity is NEVER passed as a query param; it is resolved by
// the server from the HTTP-only session cookie automatically.
// ============================================================

import { useState, useEffect, useCallback } from 'react';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface Order {
  order_id: string;
  restaurant_id: string;
  restaurant_name: string;
  created_at: string;
  item_summary: string;
  total_egp: number;
  status: string;
  cancellable: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total_count: number;
  total_pages: number;
}

export interface OrderHistoryState {
  orders: Order[];
  pagination: Pagination | null;
  loading: boolean;
  error: ApiError | null;
}

export interface ApiError {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string>;
}

const DEFAULT_LIMIT = 10;

// ------------------------------------------------------------------
// Hook
// ------------------------------------------------------------------
export function useOrderHistory(page: number) {
  const [state, setState] = useState<OrderHistoryState>({
    orders: [],
    pagination: null,
    loading: true,
    error: null,
  });

  const fetchOrders = useCallback(async (currentPage: number) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Credentials: 'include' ensures the HTTP-only session cookie
      // is sent; no user_id is appended to the URL (REQ8 security rule).
      const response = await fetch(
        `/api/v1/orders?page=${currentPage}&limit=${DEFAULT_LIMIT}`,
        { credentials: 'include' }
      );

      const data = await response.json();

      if (!response.ok) {
        // Map the backend error envelope to a local ApiError shape
        const apiError: ApiError = {
          status: response.status,
          code: data?.error?.code ?? 'UNKNOWN_ERROR',
          message: data?.error?.message ?? 'An unexpected error occurred.',
          fields: data?.error?.fields,
        };
        setState({ orders: [], pagination: null, loading: false, error: apiError });
        return;
      }

      setState({
        orders: data.orders ?? [],
        pagination: data.pagination ?? null,
        loading: false,
        error: null,
      });
    } catch {
      setState({
        orders: [],
        pagination: null,
        loading: false,
        error: {
          status: 0,
          code: 'NETWORK_ERROR',
          message: 'A network error occurred. Please try again.',
        },
      });
    }
  }, []);

  useEffect(() => {
    fetchOrders(page);
  }, [page, fetchOrders]);

  return state;
}
