import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, PathOptions } from 'leaflet';
import { LayerGroup, Polyline, useMap } from 'react-leaflet';

import { Id } from './id';
import { getAsync } from './overpass_api';
import { Relation, WayGroup, Way, Node } from './osm_element';
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
    const { boundary: { editing, included, excluded, notExcluded } } = useContext(Context);
    const map = useMap();

    useEffect(() => {
        async function recalcBounds() {
            if (!map || !editing) { return; }
            
            console.log('Updating bounds');
    
            const bounds = new LatLngBounds(
                // loaded enabled relations
                (await getAsync(...[...included].filter(notExcluded)) as Relation[])
                // enabled way groups
                .flatMap(r => r.children.filter(e => e instanceof WayGroup && notExcluded(e)))
                // enabled ways
                .flatMap(wg => wg.children.filter(notExcluded))
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
    }, [included, excluded, notExcluded, map, editing]);

    if (editing) {
        return <LayerGroup>
            {[...included].filter(notExcluded).map(id => <RelationPath key={id} id={id} />)}
        </LayerGroup>;
    }
}

type RelationPathProps = {
    id: Id,
};
export function RelationPath({ id }: RelationPathProps): ReactNode {
    const { boundary: { notExcluded } } = useContext(Context);
    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync(id).then(([r]) => setRelation(r as Relation));
        }
    }, [id, relation]);

    return relation?.children
        .filter(e => e instanceof WayGroup && notExcluded(e))
        .map(wg => <WayGroupPath key={wg.id} wayGroup={wg as WayGroup} />);
}

type WayGroupPathProps = {
    wayGroup: WayGroup,
};
export function WayGroupPath({ wayGroup }: WayGroupPathProps): ReactNode {
    const { boundary: { notExcluded } } = useContext(Context);

    return wayGroup.children
        .filter(notExcluded)
        .map(w => <WayPath key={w.id} id={w.id} />);
    
}

type WayPathProps = {
    id: Id,
};
export function WayPath({ id }: WayPathProps): ReactNode {
    const {
        boundary: { excluded, errors },
        hovering,
    } = useContext(Context);
    const [way, setWay] = useState(undefined as Way | undefined);
    const [renderOptions, setRenderOptions] = useState(DisabledStyle as PathOptions);

    useEffect(() => {
        if (!way || way.id !== id) {
            getAsync(id).then(([w]) => setWay(w as Way));
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
        else if (relevantIds.some(id => errors.has(id))) {
            setRenderOptions(ErrorStyle);
        }
        else if (relevantIds.some((id) => excluded.has(id))) {
            setRenderOptions(DisabledStyle);
        }
        else {
            setRenderOptions(EnabledStyle);
        }
    }, [way, hovering, errors, excluded]);
    
    if (way) {
        return <Polyline
            positions={way.children.map(n => [n.lat, n.lon] as LatLngTuple) ?? []}
            pathOptions={renderOptions}
        />;
    }
}