// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
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

// Global fetch mock — individual tests override with jest.fn() as needed.
// Using a stub avoids undici/jsdom incompatibilities (clearImmediate, markResourceTiming).
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.reject(new Error('fetch not mocked for this test'))
  ) as any;
}


