import { useMap, MapCameraChangedEvent } from '@vis.gl/react-google-maps';
import { JSX, useEffect, useState } from 'react';
import { Relation } from './relation';

export type Boundary = {
    relationId: number,
    name: string,
    ways: number[],
};

type Props = {
    boundaries: Boundary[],
}

export function BoundariesLayer({ boundaries }: Props): JSX.Element {
    const map = useMap();
    /*
    useEffect(() => {
        async function computePath(b: Boundary) {
            let bounds = new google.maps.LatLngBounds();
            if (!map) {
                return bounds;
            }

            const ways = await get_road_paths(b);
            for (const nodes of ways) {
                map.data.add(new google.maps.Data.Feature({
                    id: `${b.id}-${nodes[0].id}`,
                    geometry: new google.maps.Data.LineString(
                        nodes.map(n => {
                            const latlng = { lat: n.lat, lng: n.lon } as google.maps.LatLngLiteral;
                            bounds = bounds.extend(latlng);
                            return latlng;
                        }),
                    ),
                }));
            }

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
    */
    return <Relation id={380107} />;
}