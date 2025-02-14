import { useMap, MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import { JSX, useEffect, useState } from 'react';
import { get_road_path } from './overpass_api';

export type Boundary = {
    id: number,
    title: string,
    member_role: string,
};

type Props = {
    boundaries: Boundary[],
}

export function BoundariesLayer({ boundaries }: Props): JSX.Element {
    const map = useMap();

    useEffect(() => {
        async function computePath(b: Boundary) {
            let bounds = new google.maps.LatLngBounds();
            if (!map) {
                return bounds;
            }

            const nodes = await get_road_path(b);
            map.data.add(new google.maps.Data.Feature({
                id: b.id,
                geometry: new google.maps.Data.LineString(
                    nodes.map(n => {
                        const latlng = { lat: n.lat, lng: n.lon } as google.maps.LatLngLiteral;
                        bounds = bounds.extend(latlng);
                        return latlng;
                    }),
                ),
            }));

            return bounds;
        }

        if (!map || boundaries.length === 0) {
            return;
        }

        Promise.all(boundaries.map(b => computePath(b)))
            .then((bboxes) => {
                map.fitBounds(
                    bboxes.reduce(
                        (container, bbox) => {
                            return container.union(bbox);
                        },
                        new google.maps.LatLngBounds(),
                    ),
                );
            });
    }, [boundaries])

    return <></>;
}