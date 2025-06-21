import 'leaflet/dist/leaflet.css';

import { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

import { Icon } from 'leaflet';
import marker from 'leaflet/dist/images/marker-icon.png';
import marker2x from 'leaflet/dist/images/marker-icon-2x.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (Icon.Default.prototype as any)._getIconUrl;

Icon.Default.mergeOptions({
  iconUrl: marker,
  iconRetinaUrl: marker2x,
  shadowUrl: shadow,
});

import { TopBar } from './top_bar';
import { ContextProvider } from './context';
import { SideBar } from './side_bar';
import { BoundaryMask } from './boundary_mask';
import { StationMarkers } from './station_markers';

export default function App(): ReactNode {
  return <div className='w-full h-full flex flex-col'>
    <TopBar />
    <div className='flex flex-row flex-grow'>
      <ContextProvider>
        <SideBar />
        <MapContainer className='flex-grow'
          center={[39.568558865886956, -95.65381563753864]}
          zoom={4}
        >
          <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'></TileLayer>
          <BoundaryMask />
          <StationMarkers />
        </MapContainer>
      </ContextProvider>
    </div>
  </div>;
}
