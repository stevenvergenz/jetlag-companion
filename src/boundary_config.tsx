import { ReactNode, useContext, useEffect, useState } from 'react';

import { Id, pack, packFrom, unpack } from './id';
import { getAsync } from './overpass_cache';
import { Relation, Way, WayGroup } from './element';
import { TreeNode } from './tree_node';
import { SharedContext, notExcluded } from './context';

export function BoundaryConfig(): ReactNode {
    const {
        boundaryEditing, setBoundaryEditing,
        boundaryIncluded,
        save
    } = useContext(SharedContext);
    const [newId, setNewId] = useState('');

    function addRelation() {
        if (!newId) {
            return;
        }

        const numberId = parseInt(newId, 10);
        if (isNaN(numberId)) {
            return;
        }

        const id = pack({ type: 'relation', id: numberId });
        if (!boundaryIncluded.has(id)) {
            const newInclude = new Set([...boundaryIncluded, id]);
            setNewId('');
            save({ boundary: { included: newInclude }});
        }
    }

    return <TreeNode id='boundaries' initiallyOpen={boundaryEditing} onToggle={setBoundaryEditing}>
        <span className='font-bold'>Boundaries</span>
        <TreeNode id='boundary-settings' initiallyOpen={true}>
            <span className='font-bold'>Settings</span>
            <div>
                <input type='number' name='addBoundaryRelation' min='0' placeholder='OSM Relation ID'
                    value={newId} onChange={e => setNewId(e.target.value)}/>
                <button type='button' onClick={addRelation}>Add</button>
            </div>
        </TreeNode>
        { [...boundaryIncluded].map(id => <RelationConfig key={`c${id}`} id={id} />) }
    </TreeNode>;
}

type RelationConfigProps = {
    id: Id,
};

export function RelationConfig({ id }: RelationConfigProps): ReactNode {
    const {
        boundaryExcluded,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);

    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        let ignore = false;
        if (!relation || relation.id !== id) {
            getAsync([id])
                .then(async ([r]) => {
                    if (r instanceof Relation && !ignore) {
                        const wayIds = r.data.members
                            .flatMap(m => m.type === 'way' ? [packFrom(m)] : []);
                        console.log('[menu]', wayIds);
                        await getAsync(wayIds);
                        console.log('[menu] Ways:', r.children.filter(e => e instanceof Way).length);
                        r.calcWayGroups();
                        console.log('[menu] Way groups:', r.wayGroups?.size);
                        setRelation(r);
                    }
                });
            return () => { ignore = true; };
        }
    }, [id, relation]);

    function enabled() {
        return relation && notBoundaryExcluded(relation);
    }
    
    function setEnabled(state: boolean) {
        if (!relation) { return }
        const isIncluded = notBoundaryExcluded(relation);
        if (state && !isIncluded) {
            save({ boundary: { excluded: new Set([...boundaryExcluded].filter((id) => id !== relation.id)) }});
        }
        else if (!state && isIncluded) {
            save({ boundary: { excluded: new Set([...boundaryExcluded, relation.id]) }});
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
        boundaryExcluded,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);

    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        setInheritEnabled([...wayGroup.parentIds.values()].every(notBoundaryExcluded));
        setEnabledLocal(notBoundaryExcluded(wayGroup));
    }, [wayGroup, boundaryExcluded, notBoundaryExcluded])

    function setEnabled(state: boolean) {
        if (!wayGroup) { return; }

        const isIncluded = notBoundaryExcluded(wayGroup);
        if (state && !isIncluded) {
            const newExclude = new Set([...boundaryExcluded].filter((id) => id !== wayGroup.id));
            save({
                boundary: { excluded: newExclude },
            });
        }
        else if (!state && isIncluded) {
            const newExclude = new Set([...boundaryExcluded, wayGroup.id]);
            save({
                boundary: { excluded: newExclude },
            });
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
        boundaryExcluded,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);
    
    const [way, setWay] = useState(undefined as Way | undefined);
    const [inheritEnabled, setInheritEnabled] = useState(true);
    const [enabled, setEnabledLocal] = useState(true);

    useEffect(() => {
        if (!way || way.id !== id) {
            getAsync([id]).then(([w]) => setWay(w as Way));
        }
    }, [id, way]);

    useEffect(() => {
        if (way) {
            setInheritEnabled(notBoundaryExcluded(way)
                && way.parents.every(notBoundaryExcluded));
            setEnabledLocal(notBoundaryExcluded(way));
        }
    }, [way, boundaryExcluded, notBoundaryExcluded])


    function setEnabled(state: boolean) {
        if (!way) { return }
        const isIncluded = notBoundaryExcluded(way);
        
        if (state && !isIncluded) {
            const newExclude = new Set([...boundaryExcluded].filter((id) => id !== way.id));
            save({
                boundary: { excluded: newExclude },
            });
        }
        else if (!state && isIncluded) {
            const newExclude = new Set([...boundaryExcluded, way.id]);
            save({
                boundary: { excluded: newExclude },
            });
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