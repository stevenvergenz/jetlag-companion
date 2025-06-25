import { ReactNode, useContext, useState, useMemo } from 'react';
import { LeafletEvent, LeafletEventHandlerFnMap, LineUtil, CRS } from 'leaflet';
import { LayerGroup, Marker, Polyline, Tooltip } from 'react-leaflet';

import { SharedContext } from './context';
import { Position } from 'geojson';

function contextAction(): string {
    return !window.matchMedia('(pointer: fine') ? 'Long-press' : 'Right-click';
}

export default function BoundaryEditor(): ReactNode {
    const { boundaryPoints, setBoundaryPoints } = useContext(SharedContext);
    const [ editPoints, setEditPoints ] = useState(boundaryPoints);

    const points = editPoints.slice(0, -1).map((_, i) => 
        <BoundaryPointHandle
            key={ `boundary-point-${i}` }
            i={i}
            points={editPoints}
            update={setEditPoints}
            save={p => {
                setEditPoints(p);
                setBoundaryPoints(p);
            }}
        />
    );

    const lines = editPoints.slice(0, -1).map((_, i) =>
        <BoundaryEdgeHandle
            key={ `boundary-line-${i}` }
            i={i}
            points={editPoints}
            save={p => {
                setEditPoints(p);
                setBoundaryPoints(p);
            }}
        />
    );

    return <LayerGroup>
        { points }
        { lines }
    </LayerGroup>;
}

type BoundaryPointHandleProps = {
    i: number,
    points: Position[],
    update: (p: Position[]) => void,
    save: (p: Position[]) => void,
};

function BoundaryPointHandle({ i, points, update, save }: BoundaryPointHandleProps): ReactNode {
    const handlers = useMemo<LeafletEventHandlerFnMap>(() => ({
        drag: ({ target }: LeafletEvent) => {
            if (!target) { return; }
            const latlng = target.getLatLng();
            const newPoints = [...points];
            newPoints[i] = [latlng.lng, latlng.lat] satisfies Position;
            newPoints[newPoints.length - 1] = newPoints[0]; // Ensure the last point matches the first
            update(newPoints);
        },
        dragend: ({ target }: LeafletEvent) => {
            if (!target) { return; }
            const latlng = target.getLatLng();
            const newPoints = [...points];
            newPoints[i] = [latlng.lng, latlng.lat] satisfies Position;
            newPoints[newPoints.length - 1] = newPoints[0]; // Ensure the last point matches the first
            save(newPoints);
        },
        contextmenu: ({ target }: LeafletEvent) => {
            if (!target || points.length <= 4) { return; }
            const newPoints = [...points];
            newPoints.splice(i, 1);
            newPoints[newPoints.length - 1] = newPoints[0]; // Ensure the last point matches the first
            save(newPoints);
        },
    }), [i, points, update, save]);

    return <Marker
        position={[points[i][1], points[i][0]]}
        interactive={true}
        draggable={true}
        eventHandlers={handlers}
    >
        <Tooltip>
            {`Drag to move, ${contextAction()} to delete`}
        </Tooltip>
    </Marker>;
}

type BoundaryEdgeHandleProps = {
    i: number,
    points: Position[],
    save: (points: Position[]) => void,
};

function BoundaryEdgeHandle({ i, points, save }: BoundaryEdgeHandleProps): ReactNode {
    const handlers = useMemo<LeafletEventHandlerFnMap>(() => ({
        contextmenu: ({ target }: LeafletEvent) => {
            if (!target) { return; }
            const p1 = points[i];
            const p2 = points[i + 1];
            const pMid = LineUtil.polylineCenter([[p1[1], p1[0]], [p2[1], p2[0]]], CRS.EPSG3857);

            const newPoints = [...points];
            newPoints.splice(i + 1, 0, [pMid.lng, pMid.lat] satisfies Position);
            save(newPoints);
        },
    }), [i, points, save]);

    return <Polyline
        positions={[[points[i][1], points[i][0]], [points[i + 1][1], points[i + 1][0]]]}
        color='black'
        weight={2}
        interactive={true}
        eventHandlers={handlers}
    >
        <Tooltip>
            {`${contextAction()} to split`}
        </Tooltip>
    </Polyline>;
}