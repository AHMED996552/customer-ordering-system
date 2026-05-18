/**
 * eventSourceMock.ts
 * UC-9 — Track Live Order Status
 *
 * Reusable, controllable EventSource mock for Jest / React Testing Library.
 *
 * Usage:
 *   import { MockEventSource, installEventSourceMock, uninstallEventSourceMock } from './eventSourceMock';
 *
 *   beforeEach(() => installEventSourceMock());
 *   afterEach(() => uninstallEventSourceMock());
 *
 *   // Inside a test:
 *   const es = MockEventSource.latestInstance!;
 *   es.simulateOpen();
 *   es.simulateMessage({ new_status: 'ACCEPTED', timestamp: '2026-05-10T14:34:10Z' });
 *   es.simulateError();
 */

export type SSEStatusUpdatePayload = {
  new_status: string;
  timestamp: string;
};

/** Minimal subset of EventSource constants used in tests */
const CONNECTING = 0;
const OPEN = 1;
const CLOSED = 2;

export class MockEventSource {
  // ── static registry ──────────────────────────────────────────────────────
  static instances: MockEventSource[] = [];

  static get latestInstance(): MockEventSource | undefined {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }

  static clearInstances(): void {
    MockEventSource.instances = [];
  }

  // ── instance state ────────────────────────────────────────────────────────
  readonly url: string;
  readonly withCredentials: boolean;

  readyState: number = CONNECTING;

  // ── event handlers (set by consuming code, e.g. the component under test) ─
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  private _listeners: Map<string, Array<(event: MessageEvent) => void>> = new Map();

  // ── static constants (required by the EventSource interface) ──────────────
  static readonly CONNECTING = CONNECTING;
  static readonly OPEN = OPEN;
  static readonly CLOSED = CLOSED;

  readonly CONNECTING = CONNECTING;
  readonly OPEN = OPEN;
  readonly CLOSED = CLOSED;

  constructor(url: string, init?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = init?.withCredentials ?? false;
    MockEventSource.instances.push(this);
  }

  // ── EventSource interface ─────────────────────────────────────────────────
  addEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const bucket = this._listeners.get(type) ?? [];
    bucket.push(listener);
    this._listeners.set(type, bucket);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void): void {
    const bucket = this._listeners.get(type) ?? [];
    this._listeners.set(
      type,
      bucket.filter((l) => l !== listener)
    );
  }

  dispatchEvent(_event: Event): boolean {
    return true;
  }

  close(): void {
    this.readyState = CLOSED;
  }

  // ── Test helpers ──────────────────────────────────────────────────────────

  /** Simulate the SSE connection being established. */
  simulateOpen(): void {
    this.readyState = OPEN;
    const event = new Event('open');
    if (this.onopen) this.onopen(event);
  }

  /**
   * Simulate a `status_update` SSE event arriving with the given payload.
   * Triggers both `onmessage` and any `addEventListener('status_update', ...)` listeners.
   */
  simulateStatusUpdate(payload: SSEStatusUpdatePayload): void {
    const data = JSON.stringify(payload);
    const event = new MessageEvent('status_update', { data });

    // Trigger named event listeners (registered via addEventListener)
    const namedListeners = this._listeners.get('status_update') ?? [];
    namedListeners.forEach((listener) => listener(event));

    // Also trigger generic message listeners
    const messageListeners = this._listeners.get('message') ?? [];
    messageListeners.forEach((listener) => listener(event));

    // Trigger onmessage if set
    if (this.onmessage) this.onmessage(event);
  }

  /** Simulate a network error on the SSE connection. */
  simulateError(): void {
    this.readyState = CLOSED;
    const event = new Event('error');
    if (this.onerror) this.onerror(event);

    // Also fire error listeners registered via addEventListener
    const errorListeners = this._listeners.get('error') ?? [];
    errorListeners.forEach((listener) => listener(event as unknown as MessageEvent));
  }

  /** Simulate the server closing the stream (e.g. terminal state reached). */
  simulateServerClose(): void {
    this.readyState = CLOSED;
    // Fire close event listeners if any
    const closeListeners = this._listeners.get('close') ?? [];
    closeListeners.forEach((listener) => listener(new MessageEvent('close')));
  }

  /** Check whether close() has been called (stream was torn down). */
  get isClosed(): boolean {
    return this.readyState === CLOSED;
  }

  /** Check whether the stream is currently open. */
  get isOpen(): boolean {
    return this.readyState === OPEN;
  }
}

// ── Global installation / teardown ─────────────────────────────────────────

const _originalEventSource =
  typeof window !== 'undefined' ? (window as typeof window & { EventSource?: unknown }).EventSource : undefined;

/**
 * Replace the global EventSource with MockEventSource.
 * Call this in `beforeEach`.
 */
export function installEventSourceMock(): void {
  MockEventSource.clearInstances();
  (global as typeof global & { EventSource: unknown }).EventSource = MockEventSource;
  if (typeof window !== 'undefined') {
    (window as typeof window & { EventSource: unknown }).EventSource = MockEventSource;
  }
}

/**
 * Restore the original EventSource.
 * Call this in `afterEach`.
 */
export function uninstallEventSourceMock(): void {
  if (_originalEventSource !== undefined) {
    (global as typeof global & { EventSource: unknown }).EventSource = _originalEventSource;
    if (typeof window !== 'undefined') {
      (window as typeof window & { EventSource: unknown }).EventSource = _originalEventSource;
    }
  } else {
    delete (global as typeof global & { EventSource?: unknown }).EventSource;
    if (typeof window !== 'undefined') {
      delete (window as typeof window & { EventSource?: unknown }).EventSource;
    }
  }
  MockEventSource.clearInstances();
}
