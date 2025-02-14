'use client';
import { JSX, useState } from 'react';
import { MapContainer, TileLayer } from './lazy';
import '../../node_modules/leaflet/dist/leaflet.css';

import TopBar from './top_bar';
import { SideBar } from './side_bar';

export default function Page(): JSX.Element {
    return <div className='w-full h-full flex flex-col'>
        <TopBar />
        <div className='flex flex-row flex-grow'>
            <SideBar />
            <MapContainer className='flex-grow'
                center={[39.568558865886956, -95.65381563753864]}
                zoom={4}
            >
                <TileLayer url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'></TileLayer>
                
            </MapContainer>
        </div>
    </div>;
}