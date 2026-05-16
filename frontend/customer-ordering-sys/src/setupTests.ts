// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// ── Polyfills required by React Router v7 + MSW v2 in CRA's older jsdom ───────
import { TextEncoder, TextDecoder } from 'util';
// @ts-ignore
global.TextEncoder = TextEncoder;
// @ts-ignore
global.TextDecoder = TextDecoder;

// Polyfill Web Streams API (ReadableStream, WritableStream, TransformStream)
// required by @mswjs/interceptors used by MSW v2.
const { ReadableStream, WritableStream, TransformStream } = require('stream/web');
if (typeof global.ReadableStream === 'undefined') {
  // @ts-ignore
  global.ReadableStream = ReadableStream;
}
if (typeof global.WritableStream === 'undefined') {
  // @ts-ignore
  global.WritableStream = WritableStream;
}
if (typeof global.TransformStream === 'undefined') {
  // @ts-ignore
  global.TransformStream = TransformStream;
}

