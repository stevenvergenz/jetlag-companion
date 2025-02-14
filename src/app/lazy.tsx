import dynamic from 'next/dynamic';

export const MapContainer = dynamic(async () => (await import('react-leaflet')).MapContainer, { ssr: false });
export const TileLayer = dynamic(async () => (await import('react-leaflet')).TileLayer, { ssr: false });
export const Polyline = dynamic(async () => (await import('react-leaflet')).Polyline, { ssr: false });
export const FeatureGroup = dynamic(async () => (await import('react-leaflet')).FeatureGroup, { ssr: false });

export const BoundaryLayer = dynamic(async () => (await import('./boundary_path')).BoundaryLayer, { ssr: false });