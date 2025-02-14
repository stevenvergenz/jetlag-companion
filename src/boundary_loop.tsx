import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, LatLngExpression } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';
import { Context } from './context';
import { BoundaryError, generateBoundaryLoopPath } from './boundary_calc';

export function BoundaryLoop(): ReactNode {
    const map = useMap();
    const {
        boundary: {
            included,
            excluded,
            setPath,
            setErrors,
            editing,
        }
    } = useContext(Context);
    const [poly, setPoly] = useState([] as LatLngExpression[][]);

    useEffect(() => {
        async function helper() {
            if (!map || editing || included.size === 0) { return; }
            let p: LatLngTuple[] | undefined;
            try {
                p = await generateBoundaryLoopPath(included, excluded, map.distance.bind(map));
                setErrors(new Set());
            } catch (e) {
                if (e instanceof BoundaryError) {
                    setErrors(new Set(e.relevantIds));
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

            setPath(p);

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
    }, [included, excluded, map, editing, setPath, setErrors]);

    if (!editing) {
        return <LayerGroup>
            <Polygon pathOptions={{ color: 'black' }} positions={poly} />
        </LayerGroup>;
    }
}