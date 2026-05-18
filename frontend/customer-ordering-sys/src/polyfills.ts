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
