import { ReactNode, useMemo } from 'react';
import { Position } from 'geojson';
import { LeafletEvent, LeafletEventHandlerFnMap } from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import { contextAction } from "./util";

type BoundaryPointHandleProps = {
    i: number,
    points: Position[],
    update: (p: Position[]) => void,
    save: (p: Position[]) => void,
};

export default function BoundaryPointHandle({ i, points, update, save }: BoundaryPointHandleProps): ReactNode {
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
