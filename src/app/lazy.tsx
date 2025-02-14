import dynamic from 'next/dynamic';

export const MapContainer = dynamic(async () => (await import('react-leaflet')).MapContainer, { ssr: false });
export const TileLayer = dynamic(async () => (await import('react-leaflet')).TileLayer, { ssr: false });
export const Polyline = dynamic(async () => (await import('react-leaflet')).Polyline, { ssr: false });
export const LayerGroup = dynamic(async () => (await import('react-leaflet')).LayerGroup, { ssr: false });
