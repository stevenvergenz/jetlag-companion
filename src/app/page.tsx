'use client';
import { JSX, useState } from 'react';
import { APIProvider, Map } from '@vis.gl/react-google-maps';

import TopBar from './top_bar';
import SearchDialog from './search_dialog';

const API_KEY = "AIzaSyAcr_XaKIMdLG-vULO-PQ760gDzj3K3p0s";

export default function Page(): JSX.Element {
    const [searchVisible, setSearchVisible] = useState(false);
    return <>
        <TopBar toggleSearchVisible={() => setSearchVisible(!searchVisible)} />
        <APIProvider apiKey={API_KEY}>
            <Map
                mapId={'asdf'}
                style={{width: '100vw', height: '100vh'}}
                defaultCenter={{lat: 47.37, lng: -122.159}}
                defaultZoom={12}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
            >
            </Map>
        </APIProvider>
        <SearchDialog visible={searchVisible} close={() => setSearchVisible(false)} />
    </>;
}