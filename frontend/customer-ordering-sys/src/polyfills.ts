// ── Jest Polyfills (must run before any other code or imports) ──────────────
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

class MockBroadcastChannel {
  name: string;
  constructor(name: string) {
    this.name = name;
  }
  postMessage() {}
  onmessage() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}
global.BroadcastChannel = MockBroadcastChannel as any;

try {
  const { ReadableStream, TransformStream, WritableStream } = require('stream/web');
  if (typeof global.ReadableStream === 'undefined') {
    global.ReadableStream = ReadableStream as any;
  }
  if (typeof global.TransformStream === 'undefined') {
    global.TransformStream = TransformStream as any;
  }
  if (typeof global.WritableStream === 'undefined') {
    global.WritableStream = WritableStream as any;
  }
} catch (e) {}

// Polyfill MessageChannel and MessagePort for undici compatibility in Jest JSDOM
const { MessageChannel, MessagePort } = require('node:worker_threads');
global.MessageChannel = MessageChannel;
global.MessagePort = MessagePort;

// Polyfill Fetch API globals in Jest JSDOM using undici (recommended for MSW v2)
const { fetch, Request, Response, Headers, FormData } = require('undici');
global.fetch = fetch;
global.Request = Request;
global.Response = Response;
global.Headers = Headers;
global.FormData = FormData;

if (typeof window !== 'undefined') {
  (window as any).fetch = fetch;
  (window as any).Request = Request;
  (window as any).Response = Response;
  (window as any).Headers = Headers;
  (window as any).FormData = FormData;
}

// Polyfill performance.markResourceTiming for undici in JSDOM
if (typeof global !== 'undefined' && global.performance) {
  (global.performance as any).markResourceTiming = (global.performance as any).markResourceTiming || (() => {});
} else {
  global.performance = require('node:perf_hooks').performance;
  (global.performance as any).markResourceTiming = (() => {});
}

// Polyfill setImmediate and clearImmediate for undici/JSDOM
global.setImmediate = global.setImmediate || ((fn: any, ...args: any[]) => setTimeout(fn, 0, ...args) as any);
global.clearImmediate = global.clearImmediate || ((id: any) => clearTimeout(id));

if (typeof window !== 'undefined') {
  if (window.performance) {
    (window.performance as any).markResourceTiming = (window.performance as any).markResourceTiming || (() => {});
  } else {
    (window as any).performance = global.performance;
  }
  (window as any).setImmediate = (window as any).setImmediate || global.setImmediate;
  (window as any).clearImmediate = (window as any).clearImmediate || global.clearImmediate;
}

