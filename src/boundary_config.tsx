import { ReactNode, useContext, useEffect, useState } from 'react';

import { Id, pack, unpack } from './id';
import { getAsync } from './overpass_api';
import { Relation, Way, WayGroup } from './element';
import { TreeNode } from './tree_node';
import { Context } from './context';

export function BoundaryConfig(): ReactNode {
    const {
        boundary: {
            editing, setEditing,
            included, setIncluded,
        },
        save,
    } = useContext(Context);
    const [newId, setNewId] = useState(0);

    function addRelation() {
        if (!newId) {
            return;
        }

        const id = pack({ type: 'relation', id: newId });
        if (!included.has(id)) {
            setIncluded(new Set([...included, id]));
            setNewId(0);
        }
    }

    return <TreeNode id='boundaries' initiallyOpen={editing} onToggle={setEditing}>
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
        { [...included].map(id => <RelationConfig key={`c${id}`} id={id} />) }
    </TreeNode>;
}

type RelationConfigProps = {
    id: Id,
};

export function RelationConfig({ id }: RelationConfigProps): ReactNode {
    const {
        boundary: {
            excluded, setExcluded, notExcluded,
        },
        hovering, setHovering,
    } = useContext(Context);

    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync(id).then(([r]) => setRelation(r as Relation));
        }
    }, [id, relation]);

    function enabled() {
        return relation && notExcluded(relation);
    }
    function setEnabled(state: boolean) {
        if (!relation) { return }
        const isIncluded = notExcluded(relation);
        if (state && !isIncluded) {
            setExcluded(new Set([...excluded].filter((id) => id !== relation.id)));
        }
        else if (!state && isIncluded) {
            setExcluded(new Set([...excluded, relation.id]));
        }
    }

    function genLabel() {
        if (relation) {
            return <label>
                <input type='checkbox' checked={enabled()} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {relation.name} (
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${unpack(relation.id).id}`}>{relation.id}</a>
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
        { relation?.children
            .filter(e => e.data.type === 'wayGroup')
            .map(wg => <WayGroupConfig key={'c' + wg.id} wayGroup={wg as WayGroup} />) }
    </TreeNode>;
}


type WayGroupConfigProps = {
    wayGroup: WayGroup,
};

export function WayGroupConfig({ wayGroup }: WayGroupConfigProps): ReactNode {
    const {
        boundary: { excluded, setExcluded, notExcluded },
        hovering, setHovering,
    } = useContext(Context);

    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        setInheritEnabled([...wayGroup.parentIds.values()].every(notExcluded));
        setEnabledLocal(notExcluded(wayGroup));
    }, [wayGroup, excluded, notExcluded])

    function setEnabled(state: boolean) {
        if (!wayGroup) { return }
        const isIncluded = notExcluded(wayGroup);
        if (state && !isIncluded) {
            setExcluded(new Set([...excluded].filter((id) => id !== wayGroup.id)));
        }
        else if (!state && isIncluded) {
            setExcluded(new Set([...excluded, wayGroup.id]));
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
        boundary: { excluded, setExcluded, notExcluded },
        hovering, setHovering,
    } = useContext(Context);

    const [way, setWay] = useState(undefined as Way | undefined);
    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        if (!way || way.id !== id) {
            getAsync(id).then(([w]) => setWay(w as Way));
        }
    }, [id, way]);

    useEffect(() => {
        if (way) {
            setInheritEnabled(notExcluded(way)
                && way.parents.every(notExcluded));
            setEnabledLocal(notExcluded(way));
        }
    }, [way, excluded, notExcluded])


    function setEnabled(state: boolean) {
        if (!way) { return }
        const isIncluded = notExcluded(way);
        if (state && !isIncluded) {
            setExcluded(new Set([...excluded].filter((id) => id !== way.id)));
        }
        else if (!state && isIncluded) {
            setExcluded(new Set([...excluded, way.id]));
        }
    }

    function genLabel() {
        if (way) {
            return <label>
                <input type='checkbox' disabled={!inheritEnabled}
                    checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {way.name} (
                <a target='_blank' href={`https://www.openstreetmap.org/way/${unpack(way.id).id}`}>{way.id}</a>
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