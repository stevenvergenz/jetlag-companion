import { ReactNode, useContext } from 'react';
import { LatLngTuple } from 'leaflet';
import { LayerGroup, CircleMarker, Polyline } from 'react-leaflet';

import { SharedContext } from './context';

export default function BoundaryEditor(): ReactNode {
    const { boundaryPoints, setBoundaryPoints } = useContext(SharedContext);

    const points = boundaryPoints.map((p, i) => 
        <CircleMarker
            key={ `boundary-point-${i}` }
            center={[p[1], p[0]]}
            radius={5}
            color='black'
            fillColor='grey'
            fillOpacity={0.5}
            interactive={true}
            eventHandlers={{
            }}
        />
    );

    const lines = boundaryPoints.map((p, i, arr) => {
        const points: LatLngTuple[] = i < arr.length - 1
            ? [[p[1], p[0]], [arr[i + 1][1], arr[i + 1][0]]]
            : [[p[1], p[0]], [arr[0][1], arr[0][0]]];
        return <Polyline
            key={ `boundary-line-${i}` }
            positions={points}
            color='black'
            weight={2}
            interactive={false}
        />;
    });

    return <LayerGroup>
        { points }
        { lines }
    </LayerGroup>;
}