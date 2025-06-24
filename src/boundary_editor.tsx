import { ReactNode, useContext, useState, useRef, useMemo } from 'react';
import { LatLngTuple, LeafletEvent, LeafletEventHandlerFnMap, Marker as LeafletMarker } from 'leaflet';
import { LayerGroup, Marker, Polyline, Tooltip } from 'react-leaflet';

import { SharedContext } from './context';
import { Position } from 'geojson';

export default function BoundaryEditor(): ReactNode {
    const { boundaryPoints, setBoundaryPoints } = useContext(SharedContext);
    const [ editPoints, setEditPoints ] = useState<LatLngTuple[]>(boundaryPoints.map(p => [p[1], p[0]]));

    const points = editPoints.slice(0, -1).map((p, i) => 
        <BoundaryPointHandle
            key={ `boundary-point-${i}` }
            pos={p}
            dragPos={(newPos: LatLngTuple) => {
                const newPoints = [...editPoints];
                newPoints[i] = newPos;
                if (i === 0) {
                    newPoints[newPoints.length - 1] = newPos; // Ensure the last point matches the first
                }
                setEditPoints(newPoints);
            }}
            setPos={(newPos: LatLngTuple | null) => {
                const newPoints = [...editPoints];
                if (newPos) {
                    newPoints[i] = newPos;
                    if (i === 0) {
                        newPoints[newPoints.length - 1] = newPos; // Ensure the last point matches the first
                    }
                } else if (newPoints.length > 4){
                    newPoints.splice(i, 1);
                    if (i === 0) {
                        newPoints[newPoints.length - 1] = newPoints[0]; // Ensure the last point matches the first
                    }
                }
                setEditPoints(newPoints);
                setBoundaryPoints(newPoints.map(p => [p[1], p[0]] as Position));
            }}
        />
    );

    const lines = editPoints.map((p, i, arr) =>
        i < arr.length - 1 && <Polyline
            key={ `boundary-line-${i}` }
            positions={[p, arr[i + 1]]}
            color='black'
            weight={2}
            interactive={false}
        />
    );

    return <LayerGroup>
        { points }
        { lines }
    </LayerGroup>;
}

type BoundaryPointHandleProps = {
    pos: LatLngTuple,
    dragPos: (p: LatLngTuple) => void,
    setPos: (p: LatLngTuple | null) => void,
};

function BoundaryPointHandle({ pos, dragPos, setPos }: BoundaryPointHandleProps): ReactNode {
    const markerRef = useRef<LeafletMarker | null>(null);

    const handlers = useMemo<LeafletEventHandlerFnMap>(() => ({
        drag: ({ target }: LeafletEvent) => {
            if (target) {
                const latlng = target.getLatLng();
                dragPos([latlng.lat, latlng.lng]);
            }
        },
        dragend: ({ target }: LeafletEvent) => {
            if (target) {
                const latlng = target.getLatLng();
                setPos([latlng.lat, latlng.lng]);
            }
        },
        contextmenu: ({ target }: LeafletEvent) => {
            if (target) {
                setPos(null);
            }
        },
    }), [dragPos, setPos]);

    const deleteActionStr = !window.matchMedia('(pointer: fine') ? 'long-press' : 'right-click';
    
    return <Marker
        position={pos}
        interactive={true}
        draggable={true}
        ref={markerRef}
        eventHandlers={handlers}
    >
        <Tooltip>
            {`Drag to move, ${deleteActionStr} to delete`}
        </Tooltip>
    </Marker>;
}