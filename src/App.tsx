import '../node_modules/leaflet/dist/leaflet.css';

import { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

import { TopBar } from './top_bar';
import { ContextProvider } from './context';
import { SideBar } from './side_bar';
//import { BoundaryLayer } from './boundary_path';
import { BoundaryLoop } from './boundary_loop';
import { StationMarkers } from './station_config';

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
          { /* <BoundaryLayer /> */ }
          <BoundaryLoop />
          <StationMarkers />
        </MapContainer>
      </ContextProvider>
    </div>
  </div>;
}
