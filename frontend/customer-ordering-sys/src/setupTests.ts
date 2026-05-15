import '@testing-library/jest-dom';

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
