// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';
import React from 'react';

jest.mock('react-leaflet', () => {
  const React = require('react');
  return {
    MapContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'MapContainer' }, children),
    TileLayer: () => React.createElement('div', { 'data-testid': 'TileLayer' }),
    Marker: ({ children }: any) => React.createElement('div', { 'data-testid': 'Marker' }, children),
    Popup: ({ children }: any) => React.createElement('div', { 'data-testid': 'Popup' }, children),
    useMapEvents: () => ({}),
    useMap: () => ({
      setView: jest.fn(),
      flyTo: jest.fn(),
      getZoom: () => 13,
    }),
  };
});

Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => '12345678-1234-1234-1234-1234567890ab',
  },
});
