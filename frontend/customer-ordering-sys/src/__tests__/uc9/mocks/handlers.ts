/**
 * handlers.ts
 * UC-9 — Track Live Order Status
 *
 * Centralised MSW request handlers for all UC-9 scenarios.
 * Import the specific handler sets you need in each test file, or use
 * the `defaultHandlers` export with the shared MSW server.
 *
 * Uses MSW v1 API (rest.get / setupServer).
 */

import { rest, RestHandler } from 'msw';
import {
  makeActiveOrder,
  makeTerminalOrder,
  makeAccessDeniedError,
  makePendingOrder,
  ORDER_ID_ACTIVE,
  ORDER_ID_TERMINAL,
  ORDER_ID_OTHER_USER,
} from './payloadFactory';

// ── Base URL helpers ──────────────────────────────────────────────────────────

const orderUrl = (orderId: string) => `/api/v1/orders/${orderId}`;

// ── Happy path handlers ───────────────────────────────────────────────────────

/**
 * Returns a canonical active IN_PREPARATION order for ORDER_ID_ACTIVE.
 */
export const activeOrderHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) => res(ctx.status(200), ctx.json(makeActiveOrder()))
);

/**
 * Returns a PENDING order for ORDER_ID_ACTIVE.
 */
export const pendingOrderHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) => res(ctx.status(200), ctx.json(makePendingOrder()))
);

/**
 * Returns a DELIVERED terminal order for ORDER_ID_TERMINAL.
 * stream_endpoint is null — no SSE should be opened.
 */
export const deliveredOrderHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_TERMINAL),
  (_req, res, ctx) => res(ctx.status(200), ctx.json(makeTerminalOrder('DELIVERED')))
);

/**
 * Returns a CANCELLED terminal order for ORDER_ID_TERMINAL.
 * stream_endpoint is null — no SSE should be opened.
 */
export const cancelledOrderHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_TERMINAL),
  (_req, res, ctx) => res(ctx.status(200), ctx.json(makeTerminalOrder('CANCELLED')))
);

// ── Authorization guard handlers ──────────────────────────────────────────────

/**
 * Returns 403 ORDER_ACCESS_DENIED for ORDER_ID_OTHER_USER.
 * Used to validate that access denial is uniform (anti-enumeration).
 */
export const otherUserOrderHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_OTHER_USER),
  (_req, res, ctx) => res(ctx.status(403), ctx.json(makeAccessDeniedError()))
);

/**
 * Returns 403 ORDER_ACCESS_DENIED for any order ID not found.
 * Simulates the nonexistent order case — same response as unauthorized.
 */
export const nonexistentOrderHandler: RestHandler = rest.get(
  '/api/v1/orders/ORD-DOES-NOT-EXIST',
  (_req, res, ctx) => res(ctx.status(403), ctx.json(makeAccessDeniedError()))
);

// ── Error handlers ────────────────────────────────────────────────────────────

/**
 * Simulates an HTTP 500 Internal Server Error.
 */
export const serverErrorHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) =>
    res(
      ctx.status(500),
      ctx.json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred.',
        },
      })
    )
);

/**
 * Simulates a malformed (non-JSON) response body.
 */
export const malformedResponseHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) =>
    res(ctx.status(200), ctx.set('Content-Type', 'application/json'), ctx.body('NOT_VALID_JSON{{{{'))
);

/**
 * Simulates a delayed response (300 ms) — useful for loading indicator tests.
 */
export const delayedResponseHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) =>
    res(ctx.delay(300), ctx.status(200), ctx.json(makeActiveOrder()))
);

/**
 * Simulates a response missing the `stream_endpoint` field entirely.
 */
export const missingStreamEndpointHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) => {
    const payload = makeActiveOrder();
    const { stream_endpoint: _removed, ...orderWithoutEndpoint } = payload.order;
    return res(ctx.status(200), ctx.json({ order: orderWithoutEndpoint }));
  }
);

/**
 * Simulates a response with a null status_timeline (corrupted payload).
 */
export const nullTimelineHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) => {
    const payload = makeActiveOrder();
    return res(
      ctx.status(200),
      ctx.json({ order: { ...payload.order, status_timeline: null } })
    );
  }
);

/**
 * Simulates a response with an empty status_timeline array.
 */
export const emptyTimelineHandler: RestHandler = rest.get(
  orderUrl(ORDER_ID_ACTIVE),
  (_req, res, ctx) => {
    const payload = makeActiveOrder();
    return res(
      ctx.status(200),
      ctx.json({ order: { ...payload.order, status_timeline: [] } })
    );
  }
);

/**
 * Handler factory: returns an active order with an arbitrary status.
 */
export function activeOrderWithStatusHandler(status: string): RestHandler {
  return rest.get(orderUrl(ORDER_ID_ACTIVE), (_req, res, ctx) =>
    res(ctx.status(200), ctx.json(makeActiveOrder({ status } as any))
  ));
}

// ── Default handler set (used by shared server) ───────────────────────────────

/**
 * Default handlers registered on the shared MSW server.
 * Covers the canonical happy-path for ORDER_ID_ACTIVE, terminal-state for
 * ORDER_ID_TERMINAL, and authorization guard for ORDER_ID_OTHER_USER.
 */
export const defaultHandlers: RestHandler[] = [
  activeOrderHandler,
  deliveredOrderHandler,
  otherUserOrderHandler,
  nonexistentOrderHandler,
];
