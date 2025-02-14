'use client';
import { JSX, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

import TopBar from './top_bar';
import SearchDialog from './search_dialog';

const API_KEY = "AIzaSyAcr_XaKIMdLG-vULO-PQ760gDzj3K3p0s";

export default function Page(): JSX.Element {
    const [searchVisible, setSearchVisible] = useState(false);
    const [boundaryIds, setBoundaryIds] = useState([] as number[]);

    return <div className='w-full h-full flex flex-col'>
        <TopBar />
        <div className='flex flex-row flex-grow'>
            <SearchDialog visible={searchVisible} close={() => setSearchVisible(false)}
                boundaryIds={boundaryIds} setBoundaryIds={setBoundaryIds}/>
            <APIProvider apiKey={API_KEY} region='us' language='en'>
                <Map className='flex-grow'
                    mapId={'asdf'}
                    defaultCenter={{lat: 39.568558865886956, lng: -95.65381563753864}}
                    defaultZoom={4}
                    gestureHandling={'greedy'}
                    disableDefaultUI={true}
                >
                </Map>
            </APIProvider>
        </div>
    </div>;
}