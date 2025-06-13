import { ReactNode, useContext, useMemo } from 'react';
import { LatLngBounds } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';
import { SharedContext } from './context';

export function BoundaryMask(): ReactNode {
    const map = useMap();
    const {
        boundaryPath,
        boundaryEditing,
    } = useContext(SharedContext);

    const poly = useMemo(() => {
        const innerBounds = new LatLngBounds(boundaryPath!);
        const outerBounds = innerBounds.pad(2);
        const p = [
            [
                outerBounds.getNorthEast(), outerBounds.getNorthWest(),
                outerBounds.getSouthWest(), outerBounds.getSouthEast(),
            ],
            boundaryPath!,
        ];
        map.fitBounds(innerBounds, { padding: [0, 0] });
        return p;
    }, [boundaryPath, map]);

    if (!boundaryEditing) {
        return <LayerGroup>
            <Polygon interactive={false} pathOptions={{ color: 'black' }} positions={poly} />
        </LayerGroup>;
    }
}