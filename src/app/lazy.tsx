import dynamic from 'next/dynamic';

export const MapContainer = dynamic(async () => (await import('react-leaflet')).MapContainer, { ssr: false });
export const TileLayer = dynamic(async () => (await import('react-leaflet')).TileLayer, { ssr: false });
export const Popup = dynamic(async () => (await import('react-leaflet')).Popup, { ssr: false });
