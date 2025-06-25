import { ReactNode, useContext } from 'react';
import { SharedContext } from '../context';
import BoundaryEditor from './boundary_editor';
import BoundaryMask from './boundary_mask';

export default function Boundary(): ReactNode {
    const { boundaryEditing } = useContext(SharedContext);
    if (boundaryEditing) {
        return <BoundaryEditor />;
    } else {
        return <BoundaryMask />;
    }
}