'use client';
import { JSX, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

import TopBar from './top_bar';
import SearchDialog from './search_dialog';
import { BoundariesLayer, Boundary } from './boundaries';

const API_KEY = "AIzaSyAcr_XaKIMdLG-vULO-PQ760gDzj3K3p0s";

export default function Page(): JSX.Element {
    const [searchVisible, setSearchVisible] = useState(false);
    const [boundaries, setBoundaries] = useState([] as Boundary[]);

    return <div className='w-full h-full flex flex-col'>
        <TopBar />
        <div className='flex flex-row flex-grow'>
            <SearchDialog visible={searchVisible} close={() => setSearchVisible(false)}
                boundaries={boundaries} setBoundaries={setBoundaries}/>
            <APIProvider apiKey={API_KEY} region='us' language='en'>
                <Map className='flex-grow'
                    mapId={'asdf'}
                    defaultCenter={{lat: 39.568558865886956, lng: -95.65381563753864}}
                    defaultZoom={4}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                >
                </Map>
                <BoundariesLayer boundaries={boundaries} />
            </APIProvider>
        </div>
    </div>;
}