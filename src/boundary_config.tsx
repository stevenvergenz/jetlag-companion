import { ReactNode, useContext, useEffect, useState } from 'react';

import { Id, pack } from './id';
import { getAsync } from './overpass_api';
import { Relation, Way, WayGroup } from './osm_element';
import { TreeNode } from './tree_node';
import { Context } from './context';

export function BoundaryConfig(): ReactNode {
    const {
        editingBoundary, setEditingBoundary,
        included, setIncluded,
        save,
    } = useContext(Context);
    const [newId, setNewId] = useState(undefined as number | undefined);

    function addRelation() {
        if (!newId) {
            return;
        }

        const id = pack({ type: 'relation', id: newId });
        if (!included.includes(id)) {
            setIncluded([...included, id]);
            setNewId(undefined);
        }
    }

    return <TreeNode id='boundaries' initiallyOpen={editingBoundary} onToggle={setEditingBoundary}>
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
        { included.map(id => <RelationConfig key={`c${id}`} id={id} />) }
    </TreeNode>;
}

type RelationConfigProps = {
    id: Id,
};

export function RelationConfig({ id }: RelationConfigProps): ReactNode {
    const {
        boundaryReady,
        hovering, setHovering,
        excluded, setExcluded,
    } = useContext(Context);

    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (boundaryReady && (!relation || relation.id !== id)) {
            getAsync([id]).then(([r]) => setRelation(r as Relation));
        }
    }, [id, relation, boundaryReady]);

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
                {relation.name} (
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${relation.id}`}>{relation.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    function hoverEnd() {
        if (hovering === id) {
            setHovering('');
        }
    }

    return <TreeNode id={id} initiallyOpen={false}
        onMouseEnter={() => setHovering(id)} onMouseLeave={hoverEnd}>
        { genLabel() }
        { relation?.children.map(wg => <WayGroupConfig key={'c' + wg.id} wayGroup={wg} />) }
    </TreeNode>;
}


type WayGroupConfigProps = {
    wayGroup: WayGroup,
};

export function WayGroupConfig({ wayGroup }: WayGroupConfigProps): ReactNode {
    const {
        hovering, setHovering,
        excluded, setExcluded,
    } = useContext(Context);

    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        setInheritEnabled([...wayGroup.parentIds.values()].every(pid => !excluded.includes(pid)));
        setEnabledLocal(!excluded.includes(wayGroup.id));
    }, [wayGroup, excluded])


    function setEnabled(state: boolean) {
        const isExcluded = excluded.includes(wayGroup.id);
        if (state && isExcluded) {
            setExcluded(excluded.filter((id) => id !== wayGroup.id));
        }
        else if (!state && !isExcluded) {
            setExcluded([...excluded, wayGroup.id]);
        }
    }

    function hoverEnd() {
        if (hovering === wayGroup.id) {
            setHovering('');
        }
    }

    return <TreeNode id={`c${wayGroup.id}`} initiallyOpen={false}
        onMouseEnter={() => setHovering(wayGroup.id)} onMouseLeave={hoverEnd}>
        <label>
            <input type='checkbox' disabled={!inheritEnabled}
                checked={enabled} onChange={e => setEnabled(e.target.checked)} />
            &nbsp;
            {wayGroup.name} ({wayGroup.id})
        </label>
        { wayGroup.children.map(w => <WayConfig key={`c${w.id}`} id={w.id} />) }
    </TreeNode>;
}


type WayConfigProps = {
    id: Id,
};

export function WayConfig({ id }: WayConfigProps): ReactNode {
    const {
        boundaryReady,
        hovering, setHovering,
        excluded, setExcluded,
    } = useContext(Context);

    const [way, setWay] = useState(undefined as Way | undefined);
    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        if (boundaryReady && (!way || way.id !== id)) {
            getAsync([id]).then(([w]) => setWay(w as Way));
        }
    }, [id, way, boundaryReady]);

    useEffect(() => {
        if (way) {
            setInheritEnabled(!excluded.includes(way.id)
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
                {way.name} (
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${way.id}`}>{way.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    function hoverEnd() {
        if (hovering === id) {
            setHovering('');
        }
    }

    if (way) {
        return <TreeNode id={way.id} initiallyOpen={true}
            onMouseEnter={() => setHovering(id)} onMouseLeave={hoverEnd}>
            { genLabel() }
        </TreeNode>;
    }
}