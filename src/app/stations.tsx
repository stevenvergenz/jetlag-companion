'use client';
import { JSX, useEffect, useState } from 'react';
import { AdvancedMarker, useMap, useMapsLibrary } from '@vis.gl/react-google-maps';

export default function Stations(): JSX.Element {
    const map = useMap(null);
    const placesLib = useMapsLibrary('places');
    const [pins, setPins] = useState([] as JSX.Element[]);

    useEffect(() => {
        async function getData() {
            if (!map || !placesLib) return;

            const res = await placesLib?.Place.searchNearby({
                fields: ['displayName', 'location'],
                locationRestriction: {
                    center: map.getCenter() as google.maps.LatLng,
                    radius: 2000,
                },
                includedPrimaryTypes: ['bus_stop'],
            });

            setPins(res.places.map((p) => {
                return <AdvancedMarker 
                    key={p.id} 
                    title={p.displayName}
                    position={p.location}
                    ></AdvancedMarker>;
            }));
        }
        getData();
    });

    return <>{pins}</>;
}