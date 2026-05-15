import '@testing-library/jest-dom';
<<<<<<< HEAD
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
=======

jest.mock('react-leaflet', () => ({
  MapContainer: ({ children }: any) => children,
  TileLayer: () => null,
  Marker: () => null,
  useMapEvents: () => ({}),
  useMap: () => ({
    setView: jest.fn(),
    getZoom: jest.fn(() => 13),
  }),
}));

jest.mock('leaflet', () => ({
  DivIcon: jest.fn(),
}));
>>>>>>> ec6d7a7 (fixed payment validations fixed connection problems handled backend errors in frontend)
