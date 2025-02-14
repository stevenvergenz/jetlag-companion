import { ReactNode, useContext, useEffect, useState } from 'react';

import { getAsync, get } from './overpass_api';
import { Relation, Way } from './osm_element';
import { TreeNode } from './tree_node';
import { Context } from './context';

export function BoundaryConfig(): ReactNode {
    const { included, setIncluded, save } = useContext(Context);
    const [newId, setNewId] = useState(undefined as number | undefined);

    function addRelation() {
        if (newId && !included.includes(newId)) {
            setIncluded([...included, newId]);
            setNewId(undefined);
        }
    }

    return <TreeNode id='boundaries' initiallyOpen={true}>
        <span className='font-bold'>Boundaries</span>
        <TreeNode id='boundary-settings' initiallyOpen={true}>
            <span className='font-bold'>Settings</span>
            <div>
                <input type='number' min='0' placeholder='OSM Relation ID'
                    value={newId} onChange={e => setNewId(e.target.valueAsNumber)}/>
                <button type='button' onClick={addRelation}>Add</button>
            </div>
            <div>
                <button type='button' onClick={save}>Save</button>
            </div>
        </TreeNode>
        { included.map(id => <RelationConfig key={`rc${id}`} id={id} />) }
    </TreeNode>;
}

type RelationConfigProps = {
    id: number,
};

export function RelationConfig({ id }: RelationConfigProps): ReactNode {
    const {
        hovering, setHovering,
        excluded, setExcluded,
    } = useContext(Context);

    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync<Relation>(id).then(r => setRelation(r));
        }
    }, [id, relation]);

    function enabled() {
        return relation && !excluded.includes(relation.id);
    }
    function setEnabled(state: boolean) {
        if (!relation) { return }
        const isExcluded = excluded.includes(relation.id);
        if (state && isExcluded) {
            setExcluded(excluded.filter((id) => id !== relation.id));
        }
        else if (!state && !isExcluded) {
            setExcluded([...excluded, relation.id]);
        }
    }

    function genLabel() {
        if (relation) {
            return <label>
                <input type='checkbox' checked={enabled()} onChange={e => setEnabled(e.target.checked)} />
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

    return <TreeNode id={id.toString()} initiallyOpen={false}
        onMouseEnter={() => setHovering(id)} onMouseLeave={hoverEnd}>
        { genLabel() }
        { relation?.wayGroups.map(w => <WayGroupConfig key={'wgc' + w.id} id={w.id} />) }
    </TreeNode>;
}


type WayGroupConfigProps = {
    id: number,
};

export function WayGroupConfig({ id }: WayGroupConfigProps): ReactNode {
    const {
        hovering, setHovering,
        excluded, setExcluded,
    } = useContext(Context);

    const [way, setWay] = useState(undefined as Way | undefined);
    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        if (!way || way.id !== id) {
            setWay(get<Way>(id));
        }
    }, [id, way]);

    useEffect(() => {
        const groupId = -(way?.id ?? 0);
        if (way) {
            setInheritEnabled(way.parents.every((p) => !excluded.includes(p.id)));
            setEnabledLocal(!excluded.includes(groupId));
        }
    }, [way, excluded])


    function setEnabled(state: boolean) {
        const groupId = -(way?.id ?? 0);
        if (!way) { return }
        const isExcluded = excluded.includes(groupId);
        if (state && isExcluded) {
            setExcluded(excluded.filter((id) => id !== groupId));
        }
        else if (!state && !isExcluded) {
            setExcluded([...excluded, groupId]);
        }
    }

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
        if (hovering === -id) {
            setHovering(0);
        }
    }

    return way && <TreeNode id={'wg'+id.toString()} initiallyOpen={false}
        onMouseEnter={() => setHovering(-id)} onMouseLeave={hoverEnd}>
        { genLabel() }
        <WayConfig id={way.id} />
        { way?.following.map(w => <WayConfig key={`wc${w.id}`} id={w.id} />) }
    </TreeNode>;
}


type WayConfigProps = {
    id: number,
};

export function WayConfig({ id }: WayConfigProps): ReactNode {
    const {
        hovering, setHovering,
        excluded, setExcluded,
    } = useContext(Context);

    const [way, setWay] = useState(undefined as Way | undefined);
    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        if (!way || way.id !== id) {
            setWay(get<Way>(id));
        }
    }, [id, way]);

    useEffect(() => {
        if (way) {
            setInheritEnabled(!excluded.includes(-way.first.id)
                && way.parents.every((p) => !excluded.includes(p.id)));
            setEnabledLocal(!excluded.includes(way.id));
        }
    }, [way, excluded])


    function setEnabled(state: boolean) {
        if (!way) { return }
        const isExcluded = excluded.includes(way.id);
        if (state && isExcluded) {
            setExcluded(excluded.filter((id) => id !== way.id));
        }
        else if (!state && !isExcluded) {
            setExcluded([...excluded, way.id]);
        }
    }

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