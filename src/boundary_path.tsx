import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, PathOptions } from 'leaflet';
import { LayerGroup, Polyline, useMap } from 'react-leaflet';

import { Id } from './id';
import { getAsync } from './overpass_api';
import { Relation, WayGroup, Way } from './osm_element';
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
    const { editingBoundary, boundaryReady, included, excluded } = useContext(Context);
    const map = useMap();

    useEffect(() => {
        async function recalcBounds() {
            if (!map || !boundaryReady || !editingBoundary) { return; }
            
            console.log('Updating bounds');
    
            const bounds = new LatLngBounds(
                // loaded enabled relations
                (await getAsync(included.filter(id => !excluded.includes(id))) as Relation[])
                // enabled way groups
                .flatMap(r => r.children.filter(wg => !excluded.includes(wg.id)))
                // enabled ways
                .flatMap(wg => wg.children.filter(w => !excluded.includes(w.id)))
                // nodes
                .flatMap(w => w.children)
                // convert to LatLngTuple
                .map(n => [n.lat, n.lon] as LatLngTuple)
            );
    
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [0, 0] });
            }
        }
        recalcBounds();
    }, [included, excluded, map, boundaryReady, editingBoundary]);

    if (editingBoundary && boundaryReady) {
        return <LayerGroup>
            {included.filter(id => !excluded.includes(id)).map(id => <RelationPath key={id} id={id} />)}
        </LayerGroup>;
    }
}

type RelationPathProps = {
    id: Id,
};
export function RelationPath({ id }: RelationPathProps): ReactNode {
    const { excluded, boundaryReady } = useContext(Context);
    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync([id]).then(([r]) => setRelation(r as Relation));
        }
    }, [id, relation]);

    if (boundaryReady) {
        return relation?.children
            .filter(wg => !excluded.includes(wg.id))
            .map(wg => <WayGroupPath key={wg.id} wayGroup={wg} />);
    }
}

type WayGroupPathProps = {
    wayGroup: WayGroup,
};
export function WayGroupPath({ wayGroup }: WayGroupPathProps): ReactNode {
    const { excluded, boundaryReady } = useContext(Context);

    if (boundaryReady) {
        return wayGroup.children
            .filter(w => !excluded.includes(w.id))
            .map(w => <WayPath key={w.id} id={w.id} />);
    }
}

type WayPathProps = {
    id: Id,
};
export function WayPath({ id }: WayPathProps): ReactNode {
    const {
        boundaryReady,
        excluded, hovering, errorWays,
    } = useContext(Context);
    const [way, setWay] = useState(undefined as Way | undefined);
    const [renderOptions, setRenderOptions] = useState(DisabledStyle as PathOptions);

    useEffect(() => {
        if (boundaryReady && (!way || way.id !== id)) {
            getAsync([id]).then(([w]) => setWay(w as Way));
        }
    }, [id, way, boundaryReady]);

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
        else if (relevantIds.some(id => errorWays.includes(id))) {
            setRenderOptions(ErrorStyle);
        }
        else if (relevantIds.some((id) => excluded.includes(id))) {
            setRenderOptions(DisabledStyle);
        }
        else {
            setRenderOptions(EnabledStyle);
        }
    }, [way, hovering, errorWays, excluded]);
    
    if (boundaryReady && way) {
        return <Polyline
            positions={way.children.map(n => [n.lat, n.lon] as LatLngTuple) ?? []}
            pathOptions={renderOptions}
        />;
    }
}