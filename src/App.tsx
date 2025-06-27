import { ReactNode, useRef } from 'react';
import { Map } from 'leaflet';
import { MapContainer, TileLayer } from 'react-leaflet';

import { ContextProvider } from './context';
import SideBar from './sidebar';
import StationMarkers from './station_markers';
import Boundary from './boundary';

export default function App(): ReactNode {
  const mapRef = useRef<Map>(null);
  return <div className='w-full h-full flex flex-row items-stretch justify-stretch'>
    <ContextProvider>
      <SideBar mapRef={mapRef} />
      <MapContainer className='flex-grow'
        center={[39.568558865886956, -95.65381563753864]}
        zoom={4}
        ref={mapRef}
      >
        <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'></TileLayer>
        <Boundary />
        <StationMarkers />
      </MapContainer>
    </ContextProvider>
  </div>;
}
