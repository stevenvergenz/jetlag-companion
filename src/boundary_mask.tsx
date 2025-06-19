import { ReactNode, useContext, useMemo } from 'react';
import { bbox, buffer, polygon, difference, featureCollection } from '@turf/turf';
import { LayerGroup, GeoJSON, useMap } from 'react-leaflet';
import { SharedContext } from './context';

export function BoundaryMask(): ReactNode {
    const map = useMap();
    const {
        boundaryPoints,
        boundaryEditing,
    } = useContext(SharedContext);

    const poly = useMemo(() => {
        const innerPoly = polygon([boundaryPoints]);
        const innerBbox = bbox(innerPoly);
        const outerPoly = buffer(innerPoly, 30, { units: 'miles' })!;
        map.fitBounds([[innerBbox[1], innerBbox[0]], [innerBbox[3], innerBbox[2]]], { padding: [0, 0] });

        return difference(featureCollection([outerPoly, innerPoly]))!;
    }, [boundaryPoints, map]);

    if (!boundaryEditing) {
        return <LayerGroup>
            <GeoJSON data={poly} interactive={false} pathOptions={{ color: 'black' }}/>
        </LayerGroup>;
    }
}