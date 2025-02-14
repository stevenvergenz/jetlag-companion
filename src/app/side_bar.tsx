import { JSX, useState, useEffect } from 'react';
import { useMap } from '@vis.gl/react-google-maps';

import { Relation } from './relation';
import { TreeNode } from './tree_node';

export function SideBar(): JSX.Element {
    const map = useMap();

    useEffect(() => {
        if (!map) { return; }
        map.data.setStyle(feature => {
            if ((feature.getProperty('highlightCount') as number ?? 0) > 0) {
                return {
                    strokeWeight: 10,
                    strokeColor: 'red',
                };
            } else {
                return {
                    strokeWeight: 2,
                    strokeColor: 'black',
                };
            }
        });
    }, [map]);

    return <div className={
        'w-30 max-w-md overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch'}>
        <TreeNode id='boundaries' initiallyOpen={true}>
            <span className='font-bold'>Boundaries</span>
            <Relation id={380107} />
            <Relation id={149149} />
            <Relation id={380109} />
        </TreeNode>
    </div>;
}
