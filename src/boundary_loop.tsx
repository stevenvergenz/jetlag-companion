import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, LatLngExpression } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';
import { Context } from './context';
import { BoundaryError, generateBoundaryLoopPath } from './boundary_calc';

export function BoundaryLoop(): ReactNode {
    const map = useMap();
    const {
        editingBoundary,
        boundaryReady,
        setBoundary,
        included, excluded,
        setErrorWays,
    } = useContext(Context);
    const [path, setPath] = useState([] as LatLngExpression[][]);

    useEffect(() => {
        async function helper() {
            if (!map || editingBoundary || !boundaryReady || included.length === 0) { return; }
            let p: LatLngTuple[] | undefined;
            try {
                p = await generateBoundaryLoopPath(included, excluded, map.distance.bind(map));
            } catch (e) {
                if (e instanceof BoundaryError) {
                    setErrorWays(e.relevantIds);
                } else {
                    throw e;
                }
            }

            if (!p) {
                console.log('Boundary path not closed');
                return;
            } else {
                console.log(`Boundary path closed with ${p.length} points`);
            }

            setBoundary(p);

            const innerBounds = new LatLngBounds(p);
            const outerBounds = innerBounds.pad(2);
            setPath([
                [
                    outerBounds.getNorthEast(), outerBounds.getNorthWest(),
                    outerBounds.getSouthWest(), outerBounds.getSouthEast(),
                ],
                p,
            ]);
            map.fitBounds(innerBounds, { padding: [0, 0] });
        }
        helper();
    }, [included, excluded, map, boundaryReady, editingBoundary, setBoundary, setErrorWays]);

    if (!editingBoundary && boundaryReady) {
        return <LayerGroup>
            <Polygon pathOptions={{ color: 'black' }} positions={path} />
        </LayerGroup>;
    }
}