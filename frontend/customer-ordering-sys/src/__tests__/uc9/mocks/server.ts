/**
 * server.ts
 * UC-9 — Track Live Order Status
 *
 * Shared MSW Node.js server for all UC-9 Jest tests.
 *
 * Usage in test files:
 *
 *   import { server } from '../mocks/server';
 *
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * To override a handler for a single test:
 *   server.use(serverErrorHandler);
 */

import { setupServer } from 'msw/node';
import { defaultHandlers } from './handlers';

/**
 * Shared MSW server instance pre-loaded with UC-9 default handlers.
 *
 * - `onUnhandledRequest: 'warn'` in listen() will surface any unexpected
 *   network calls during tests, helping catch regressions.
 */
export const server = setupServer(...defaultHandlers);
