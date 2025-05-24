import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, PathOptions } from 'leaflet';
import { LayerGroup, Polyline, useMap } from 'react-leaflet';

import { Id } from './id';
import { getAsync } from './util/overpass_cache';
import { Relation, WayGroup, Way, Node } from './element';
import { SharedContext, notExcluded } from './context';

const EnabledStyle: PathOptions = {
    stroke: true,
    color: '#3388ff',
    weight: 3,
};

const HoveredStyle: PathOptions = {
    stroke: true,
    color: 'purple',
    weight: 10,
};

const ErrorStyle: PathOptions = {
    stroke: true,
    color: 'red',
    weight: 3,
};

const DisabledStyle: PathOptions = {
    stroke: false,
};

export function BoundaryLayer(): ReactNode {
    const { boundaryEditing, boundaryIncluded, boundaryExcluded } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);
    const map = useMap();

    useEffect(() => {
        getAsync([...boundaryIncluded].filter(notBoundaryExcluded))
        .then(async (rs) => {
            const waygroups = (await Promise.all(rs.map(r => (r as Relation).getWayGroupsAsync()))).flat();
            const usedNodeIds = waygroups.flatMap(wg => {
                if (notBoundaryExcluded(wg.id)) {
                    return wg.children.flatMap(w => {
                        if (notBoundaryExcluded(w.id)) {
                            return w.childIds;
                        } else {
                            return [];
                        }
                    });
                } else {
                    return [];
                }
            });
            const nodes = (await getAsync(usedNodeIds)) as Node[];
            const bounds = new LatLngBounds(nodes.map(n => [n.lat, n.lon]));
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [0, 0] });
            }
        });
    }, [boundaryIncluded, boundaryExcluded, notBoundaryExcluded, map, boundaryEditing]);

    if (boundaryEditing) {
        return <LayerGroup>
            {[...boundaryIncluded].filter(notBoundaryExcluded).map(id => <RelationPath key={id} id={id} />)}
        </LayerGroup>;
    }
}

type RelationPathProps = {
    id: Id,
};
export function RelationPath({ id }: RelationPathProps): ReactNode {
    const { boundaryExcluded } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);
    const [relation, setRelation] = useState(undefined as Relation | undefined);

    console.log('[bounds] relation path', id);
    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync([id]).then(async ([e]) => {
                const r = e as Relation;
                await getAsync(r.childIds, { request: true });
                r.calcWayGroups();
                setRelation(r);
            })
            .catch(e => console.error(e));
        }
    }, [id, relation]);

    return relation?.children
        .filter(e => e instanceof WayGroup && notBoundaryExcluded(e))
        .map(wg => <WayGroupPath key={wg.id} wayGroup={wg as WayGroup} />);
}

type WayGroupPathProps = {
    wayGroup: WayGroup,
};
export function WayGroupPath({ wayGroup }: WayGroupPathProps): ReactNode {
    const { boundaryExcluded } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);

    console.log('[bounds] way group path', wayGroup.id);
    return wayGroup.children
        .filter(e => e instanceof Way && notBoundaryExcluded(e))
        .map(w => <WayPath key={w.id} id={w.id} />);
}

type WayPathProps = {
    id: Id,
};
export function WayPath({ id }: WayPathProps): ReactNode {
    const {
        boundaryExcluded, boundaryErrors,
        hovering,
    } = useContext(SharedContext);
    const [way, setWay] = useState(undefined as Way | undefined);
    const [renderOptions, setRenderOptions] = useState(DisabledStyle as PathOptions);

    console.log('[bounds] way path', id);

    useEffect(() => {
        if (!way || way.id !== id) {
            getAsync([id]).then(async ([w]) => {
                const way = w as Way;
                await getAsync(way.childIds, { request: true });
                setWay(w as Way);
            });
        }
    }, [id, way]);

    useEffect(() => {
        if (!way) {
            setRenderOptions(DisabledStyle);
            return;
        }

        // if (way.id === 'w:909645217') {
        //     console.log(way);
        // }

        const relevantIds = [way.id, ...way.parentIds, ...way.parents.flatMap(wg => [...wg.parentIds])];
        // console.log(relevantIds);
        if (relevantIds.includes(hovering)) {
            setRenderOptions(HoveredStyle);
        }
        else if (relevantIds.some(id => boundaryErrors.has(id))) {
            setRenderOptions(ErrorStyle);
        }
        else if (relevantIds.some((id) => boundaryExcluded.has(id))) {
            setRenderOptions(DisabledStyle);
        }
        else {
            setRenderOptions(EnabledStyle);
        }
    }, [way, hovering, boundaryErrors, boundaryExcluded]);
    
    if (way) {
        return <Polyline
            positions={way.children.map(n => [n.lat, n.lon] as LatLngTuple) ?? []}
            pathOptions={renderOptions}
        />;
    }
}