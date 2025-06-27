import { ReactNode, useContext, RefObject } from 'react';
import { Map } from 'leaflet';
import { SharedContext } from '../context';
import { Position } from 'geojson';

export default function BoundaryInit({ mapRef }: { mapRef: RefObject<Map> }): ReactNode {
    const { save } = useContext(SharedContext);

    function initBoundary() {
        if (!mapRef.current) {
            console.error('Map is not initialized');
            return;
        }
        const bounds = mapRef.current.getBounds().pad(-0.2);
        const latlngs = [
            bounds.getNorthWest(),
            bounds.getNorthEast(),
            bounds.getSouthEast(),
            bounds.getSouthWest(),
            bounds.getNorthWest(),
        ];
        const points = latlngs.map(latlng => [latlng.lng, latlng.lat] as Position);
        console.log(points);
        save({
            boundary: {
                points,
            },
        });
    }

    return <div>
        <p>Position the map on the area in which you want to play, then click "Setup".</p>
        <button onClick={initBoundary}>
            Setup
        </button>
    </div>;
}