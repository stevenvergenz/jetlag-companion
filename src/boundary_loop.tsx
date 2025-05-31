import { ReactNode, useState, useEffect, useContext, useMemo } from 'react';
import { LatLngTuple, LatLngBounds, LatLngExpression } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';
import { SharedContext } from './context';
import { BoundaryError, generateBoundaryLoopPath } from './util/boundary_calc';

export function BoundaryLoop(): ReactNode {
    const map = useMap();
    const {
        //boundaryIncluded,
        //boundaryExcluded,
        boundaryPath,
        //setBoundaryPath,
        //setBoundaryErrors,
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
    }, [boundaryPath]);
    /*const [poly, setPoly] = useState([] as LatLngExpression[][]);

    useEffect(() => {
        async function helper() {
            if (!map || boundaryEditing || boundaryIncluded.size === 0) { return; }
            //console.log(included, excluded, map, editing, setPath, setErrors);
            
            let p: LatLngTuple[] | undefined;
            try {
                p = await generateBoundaryLoopPath(boundaryIncluded, boundaryExcluded, map.distance.bind(map));
                setBoundaryErrors(new Set());
            } catch (e) {
                if (e instanceof BoundaryError) {
                    setBoundaryErrors(new Set(e.relevantIds));
                } else {
                    throw e;
                }
            }

            if (!p) {
                console.log('[boundary] Boundary path not closed');
                return;
            } else {
                console.log(`[boundary] Boundary path closed with ${p.length} points`);
            }

            setBoundaryPath(p);

            const innerBounds = new LatLngBounds(p);
            const outerBounds = innerBounds.pad(2);
            setPoly([
                [
                    outerBounds.getNorthEast(), outerBounds.getNorthWest(),
                    outerBounds.getSouthWest(), outerBounds.getSouthEast(),
                ],
                p,
            ]);
            map.fitBounds(innerBounds, { padding: [0, 0] });
        }
        helper();
    }, [boundaryIncluded, boundaryExcluded, map, boundaryEditing, setBoundaryPath, setBoundaryErrors]);*/

    if (!boundaryEditing) {
        return <LayerGroup>
            <Polygon pathOptions={{ color: 'black' }} positions={poly} />
        </LayerGroup>;
    }
}