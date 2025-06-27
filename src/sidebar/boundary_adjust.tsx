import { ReactNode } from 'react';
import { contextAction } from '../boundary/util';

export default function BoundaryAdjust(): ReactNode {
    return (
        <div className="flex flex-col items-center justify-center h-full p-4">
            <h2>Boundary Adjustment</h2>
            <p>
                Now that you've got the rough area down, refine the shape of your game boundary.
                Drag the points to move them. { contextAction() } on the edges to split them, or on the points to delete them.
            </p>
            <p>When you're satisfied, click "Next".</p>
        </div>
    );
}