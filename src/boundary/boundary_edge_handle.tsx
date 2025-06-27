import { ReactNode, useMemo, useState } from 'react';
import { Position } from 'geojson';
import { LeafletEvent, LeafletEventHandlerFnMap, LineUtil, CRS, PathOptions } from 'leaflet';
import { Polyline, Tooltip } from 'react-leaflet';
import { contextAction } from "./util";

type BoundaryEdgeHandleProps = {
    i: number,
    points: Position[],
    save: (points: Position[]) => void,
};

export default function BoundaryEdgeHandle({ i, points, save }: BoundaryEdgeHandleProps): ReactNode {
    const [hover, setHover] = useState(false);
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
        mouseover: () => setHover(true),
        mouseout: () => setHover(false),
    }), [i, points, save]);

    const pathOptions = {
        color: 'black',
        weight: hover ? 5 : 3,
    } satisfies PathOptions;

    return <Polyline
        positions={[[points[i][1], points[i][0]], [points[i + 1][1], points[i + 1][0]]]}
        pathOptions={pathOptions}
        interactive={true}
        eventHandlers={handlers}
    >
        <Tooltip>
            {`${contextAction()} to split`}
        </Tooltip>
    </Polyline>;
}