import { ReactNode, useContext, useMemo } from 'react';
import { polygon, area, convertArea } from '@turf/turf';
import { SharedContext } from '../context';
import { contextAction } from '../boundary/util';

export default function BoundaryAdjust(): ReactNode {
    const { boundaryPoints } = useContext(SharedContext);
    const boundedArea = useMemo(() => {
        if (boundaryPoints.length < 4) {
            return 0;
        }
        const p = polygon([boundaryPoints]);
        return convertArea(area(p), 'meters', 'miles');
    }, [boundaryPoints]);

    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            <h2>Boundary Adjustment</h2>
            <p>
                Now that you've got the rough area down, refine the shape of your game boundary.
                Drag the points to move them. { contextAction() } on the edges to split them, or on the points to delete them.
            </p>
            <p>The selected area is <b>{boundedArea.toPrecision(4)}</b> square miles.</p>
            <p>When you're satisfied, click "Next".</p>
        </div>
    );
}