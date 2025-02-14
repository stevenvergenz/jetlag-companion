import { JSX, useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Relation as OsmRelation, getRelation } from './overpass_api';
import { Way } from './way';
import { TreeNode } from './tree_node';

type Props = {
    id: number,
};

export function Relation({ id }: Props): JSX.Element {
    const [r, setR] = useState(undefined as OsmRelation | undefined);

    useEffect(() => {
        getRelation(id).then(r => setR(r));
    }, [id]);

    function genLabel() {
        if (r) {
            return <label>
                <input type='checkbox' />
                &nbsp;
                {r.name} (r:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${r.id}`}>{r.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    return <TreeNode id={id.toString()} initiallyOpen={true}>
        { genLabel() }
        { r?.wayGroups.map(w => <Way key={'wg' + w.id} id={w.id} group={true} />) }
    </TreeNode>;
}