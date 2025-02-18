import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, PathOptions } from 'leaflet';
import { LayerGroup, Polyline, useMap } from 'react-leaflet';

import { Id } from './id';
import { getAsync } from './overpass_cache';
import { Relation, WayGroup, Way, Node } from './element';
import { Context } from './context';

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
    const { boundaryEditing, boundaryIncluded, boundaryExcluded, notBoundaryExcluded } = useContext(Context);
    const map = useMap();

    useEffect(() => {
        async function recalcBounds() {
            if (!map || !boundaryEditing) { return; }
            
            console.log('Updating bounds');
    
            const bounds = new LatLngBounds(
                // loaded enabled relations
                (await getAsync([...boundaryIncluded].filter(notBoundaryExcluded)) as Relation[])
                // enabled way groups
                .flatMap(r => r.children.filter(e => e instanceof WayGroup && notBoundaryExcluded(e)))
                // enabled ways
                .flatMap(wg => wg.children.filter(notBoundaryExcluded))
                // nodes
                .flatMap(w => w.children as Node[])
                // convert to LatLngTuple
                .map(n => [n.lat, n.lon] as LatLngTuple)
            );
    
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [0, 0] });
            }
        }
        recalcBounds();
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
    const { notBoundaryExcluded } = useContext(Context);
    const [relation, setRelation] = useState(undefined as Relation | undefined);

    console.log('relation path', id);
    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync([id]).then(([r]) => setRelation(r as Relation));
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
    const { notBoundaryExcluded } = useContext(Context);

    console.log('way group path', wayGroup.id);
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
    } = useContext(Context);
    const [way, setWay] = useState(undefined as Way | undefined);
    const [renderOptions, setRenderOptions] = useState(DisabledStyle as PathOptions);

    console.log('way path', id);

    useEffect(() => {
        if (!way || way.id !== id) {
            getAsync([id]).then(([w]) => setWay(w as Way));
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