import { ReactNode, useContext, useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';

import { getAsync, get } from './overpass_api';
import { Relation, Way } from './osm_element';
import { TreeNode } from './tree_node';
import { Context } from './context';

type RelationConfigProps = {
    id: number,
};

export function RelationConfig({ id }: RelationConfigProps): ReactNode {
    const {
        hovering, setHovering
    } = useContext(Context);

    const [relation, setRelation] = useState(undefined as Relation | undefined);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            setRelation(get<Relation>(id));
        }
    }, [id]);

    function genLabel() {
        if (relation) {
            return <label>
                <input type='checkbox' checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {relation.name} (r:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${relation.id}`}>{relation.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    function hoverEnd() {
        if (hovering === id) {
            setHovering(0);
        }
    }

    return <TreeNode id={id.toString()} initiallyOpen={true}
        onMouseEnter={() => setHovering(id)} onMouseLeave={hoverEnd}>
        { genLabel() }
        { relation?.wayGroups.map(w => <WayGroupConfig key={'wg' + w.id} id={w.id} inheritEnabled={enabled} />) }
    </TreeNode>;
}


type WayGroupConfigProps = {
    id: number,
    inheritEnabled: boolean,
};

export function WayGroupConfig({ id, inheritEnabled }: WayGroupConfigProps): ReactNode {
    const {
        hovering, setHovering
    } = useContext(Context);

    const [way, setWay] = useState(undefined as Way | undefined);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (!way || way.id !== id) {
            setWay(get<Way>(id));
        }
    }, [id]);

    function genLabel() {
        if (way) {
            return <label>
                <input type='checkbox' disabled={!inheritEnabled}
                    checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {way.name} (wg:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${way.id}`}>{way.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    function hoverEnd() {
        if (hovering === id) {
            setHovering(0);
        }
    }

    return <TreeNode id={'g'+id.toString()} initiallyOpen={false}
        onMouseEnter={() => setHovering(id)} onMouseLeave={hoverEnd}>
        { genLabel() }
        { way?.following.map(w => <WayConfig key={w.id} id={w.id} inheritEnabled={inheritEnabled && enabled} />) }
    </TreeNode>;
}


type WayConfigProps = {
    id: number,
    inheritEnabled: boolean,
};

export function WayConfig({ id, inheritEnabled }: WayConfigProps): ReactNode {
    const {
        hovering, setHovering
    } = useContext(Context);

    const [way, setWay] = useState(undefined as Way | undefined);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        if (!way || way.id !== id) {
            setWay(get<Way>(id));
        }
    }, [id]);

    function genLabel() {
        if (way) {
            return <label>
                <input type='checkbox' disabled={!inheritEnabled}
                    checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {way.name} (w:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${way.id}`}>{way.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    function hoverEnd() {
        if (hovering === id) {
            setHovering(0);
        }
    }

    return way && <TreeNode id={way.id.toString()} initiallyOpen={true}
        onMouseEnter={() => setHovering(id)} onMouseLeave={hoverEnd}>
        { genLabel() }
    </TreeNode>;
}