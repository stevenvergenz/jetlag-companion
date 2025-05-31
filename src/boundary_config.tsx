import { ReactNode, useContext, useState } from 'react';

import { pack, unpack, Relation, Way, Run } from './data/index';
import { getAsync, memCacheId } from './util/overpass_cache';
import { TreeNode } from './util/tree_node';
import { SharedContext, notExcluded } from './context';

export function BoundaryConfig(): ReactNode {
    const {
        boundaryEditing, setBoundaryEditing,
        boundaryIncluded,
        save
    } = useContext(SharedContext);
    const [newId, setNewId] = useState('');
    const [children, setChildren] = useState([] as Relation[]);

    async function addRelation() {
        if (!newId) {
            return;
        }

        const numberId = parseInt(newId, 10);
        if (isNaN(numberId)) {
            return;
        }

        const id = pack({ type: 'relation', id: numberId });
        const r = await getAsync([id]);
        if (!r) {
            console.error(`Not a real relation id: ${id}`);
            return;
        }

        if (!boundaryIncluded.has(id)) {
            const newInclude = new Set([...boundaryIncluded, id]);
            setNewId('');
            save({ boundary: { included: newInclude }});
        }
    }

    if (children.length !== boundaryIncluded.size) {
        getAsync([...boundaryIncluded]).then(c => {
            setChildren(c.filter(e => e instanceof Relation));
        });
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
        { children.map(r => <RelationConfig key={`c${r.id}`} relation={r} />) }
    </TreeNode>;
}

type RelationConfigProps = {
    relation: Relation,
};

export function RelationConfig({ relation }: RelationConfigProps): ReactNode {
    const {
        boundaryExcluded,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);
    const [children, setChildren] = useState(relation.childrenOfType(Run));

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
        if (hovering === relation.id) {
            setHovering('');
        }
    }

    if (relation.childrenOfType(Way).length < relation.childRefsOfType('way').length
        || relation.childrenOfType(Run).length === 0
    ) {
        Run.generateFromRelation(relation).then(runs => {
            for (const r of runs) {
                memCacheId.set(r.id, r);
            }
            setChildren(runs);
        });
    }

    return <TreeNode id={relation.id} initiallyOpen={false}
        onMouseEnter={() => setHovering(relation.id)} onMouseLeave={hoverEnd}>
        { genLabel() }
        { children.map(run => <RunConfig key={'c' + run.id} run={run} />) }
    </TreeNode>;
}

type RunConfigProps = {
    run: Run,
};

export function RunConfig({ run }: RunConfigProps): ReactNode {
    const {
        boundaryExcluded,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);

    function setEnabled(state: boolean) {
        if (!run) { return; }

        const isIncluded = notBoundaryExcluded(run);
        if (state && !isIncluded) {
            const newExclude = new Set([...boundaryExcluded].filter((id) => id !== run.id));
            save({
                boundary: { excluded: newExclude },
            });
        }
        else if (!state && isIncluded) {
            const newExclude = new Set([...boundaryExcluded, run.id]);
            save({
                boundary: { excluded: newExclude },
            });
        }
    }

    function hoverEnd() {
        if (hovering === run.id) {
            setHovering('');
        }
    }

    const inheritEnabled = run.parentRefs.map(r => r.id).every(notBoundaryExcluded);
    const enabledLocal = notBoundaryExcluded(run);

    return <TreeNode id={`c${run.id}`} initiallyOpen={false}
        onMouseEnter={() => setHovering(run.id)} onMouseLeave={hoverEnd}>
        <label>
            <input type='checkbox' disabled={!inheritEnabled}
                checked={enabledLocal} onChange={e => setEnabled(e.target.checked)} />
            &nbsp;
            {run.name} ({run.id})
        </label>
        { run.childrenOfType(Way).map(w => <WayConfig key={`c${w.id}`} way={w} />) }
    </TreeNode>;
}

type WayConfigProps = {
    way: Way,
};

export function WayConfig({ way }: WayConfigProps): ReactNode {
    const {
        boundaryExcluded,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);

    const inheritEnabled = notBoundaryExcluded(way)
        && way.parentsOfType(Run).every(notBoundaryExcluded);
    const enabledLocal = notBoundaryExcluded(way);

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
                    checked={enabledLocal} onChange={e => setEnabled(e.target.checked)} />
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
        if (hovering === way.id) {
            setHovering('');
        }
    }

    if (way) {
        return <TreeNode id={way.id} initiallyOpen={true}
            onMouseEnter={() => setHovering(way.id)} onMouseLeave={hoverEnd}>
            { genLabel() }
        </TreeNode>;
    }
}