import { ReactNode, useContext, useState } from 'react';
import { LayerGroup } from 'react-leaflet';
import { SharedContext } from '../context';
import BoundaryPointHandle from './boundary_point_handle';
import BoundaryEdgeHandle from './boundary_edge_handle';

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
