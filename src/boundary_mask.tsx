import { ReactNode, useContext, useMemo } from 'react';
import { Position } from 'geojson';
import { bbox, buffer, polygon } from '@turf/turf';
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

        const innerGeo = innerPoly.geometry.coordinates;
        const outerGeo = outerPoly.geometry.coordinates as Position[][];

        return polygon([...outerGeo, ...innerGeo]);
    }, [boundaryPoints, map]);

    if (!boundaryEditing) {
        return <LayerGroup>
            <GeoJSON data={poly} interactive={false} />
        </LayerGroup>;
    }
}