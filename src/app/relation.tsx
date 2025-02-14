import { JSX, useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Relation as OsmRelation, getRelation, OsmElementType } from './overpass_api';
import { WayGroup } from './way_group';
import { TreeNode } from './tree_node';
import { onHover, onUnhover } from './hover_handler';

type Props = {
    id: number,
};

export function Relation({ id }: Props): JSX.Element {
    const map = useMap();
    const [relation, setRelation] = useState(undefined as OsmRelation | undefined);

    useEffect(() => {
        getRelation(id).then(r => setRelation(r));
    }, [id]);

    function genLabel() {
        if (relation) {
            return <label>
                <input type='checkbox' />
                &nbsp;
                {relation.name} (r:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${relation.id}`}>{relation.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    return <TreeNode id={id.toString()} initiallyOpen={true}
        onMouseEnter={onHover(map, relation?.ways.map(w => w.id))}
        onMouseLeave={onUnhover(map, relation?.ways.map(w => w.id))}>
        { genLabel() }
        { relation?.wayGroups.map(w => <WayGroup key={'wg' + w.id} id={w.id} />) }
    </TreeNode>;
}