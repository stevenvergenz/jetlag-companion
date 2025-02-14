import { JSX, useState, useEffect, useContext } from 'react';

import { TreeNode } from './tree_node';
import { RelationConfig } from './boundary_config';
import { Context } from './context';

export function SideBar(): JSX.Element {
    const {
        hovering, setHovering,
        included, setIncluded,
    } = useContext(Context);

    return <div className={
        'w-30 max-w-md overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch'}>
        <TreeNode id='boundaries' initiallyOpen={true}>
            <span className='font-bold'>Boundaries</span>
            { included.map(id => <RelationConfig key={id} id={id} />) }
        </TreeNode>
    </div>;
}