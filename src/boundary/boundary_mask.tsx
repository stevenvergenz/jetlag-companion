import { ReactNode, useContext, useMemo } from 'react';
import { Polygon, useMap } from 'react-leaflet';
import { LatLngTuple } from 'leaflet';
import { bbox, buffer, polygon } from '@turf/turf';
import { SharedContext } from '../context';

export default function BoundaryMask(): ReactNode {
    const map = useMap();
    const {
        boundaryPoints,
    } = useContext(SharedContext);

    const poly = useMemo<LatLngTuple[][]>(() => {
        if (boundaryPoints.length < 4) {
            return [];
        }
        
        const innerPoly = polygon([boundaryPoints]);
        const innerBbox = bbox(innerPoly);
        const outerPoly = buffer(innerPoly, 30, { units: 'miles' })!;
        map.fitBounds([[innerBbox[1], innerBbox[0]], [innerBbox[3], innerBbox[2]]], { padding: [0, 0] });

        return [
            outerPoly.geometry.coordinates[0].map(p => [p[1], p[0]] as LatLngTuple),
            innerPoly.geometry.coordinates[0].map(p => [p[1], p[0]] as LatLngTuple),
        ];
    }, [boundaryPoints, map]);

    return boundaryPoints.length >= 4
        && <Polygon positions={poly} pathOptions={{ color: 'black', fillColor: 'black' }}/>;
}
