import { ReactNode, useState, useEffect, useContext } from 'react';

import { get, getAsync } from './overpass_api';
import { Relation, Way } from './osm_element';
import { LayerGroup, Polyline } from './lazy';
import { Context } from './context';
import { LatLngTuple, PathOptions } from 'leaflet';

const EnabledStyle: PathOptions = {
    stroke: true,
    color: '#3388ff',
    weight: 3,
};

const HoveredStyle: PathOptions = {
    stroke: true,
    color: 'red',
    weight: 10,
};

const DisabledStyle: PathOptions = {
    stroke: false,
};

export function BoundaryLayer(): ReactNode {
    const { included } = useContext(Context);

    return <LayerGroup>
        {included.map(id => <RelationPath key={`rp${id}`} id={id} />)}
    </LayerGroup>;
}

type RelationPathProps = {
    id: number,
};
export function RelationPath({ id }: RelationPathProps): ReactNode {
    const { excluded } = useContext(Context);

    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            getAsync<Relation>(id).then((r) => setRelation(r));
        }
    }, [id]);

    return <>
        { relation
            && !excluded.includes(relation.id) 
            && relation.ways.map(w => <WayPath key={`wp${w.id}`} id={w.id} />) }
    </>;
}

type WayPathProps = {
    id: number,
};
export function WayPath({ id }: WayPathProps): ReactNode {
    const {
        excluded, hovering,
    } = useContext(Context);
    const [way, setWay] = useState(undefined as Way | undefined);

    useEffect(() => {
        if (!way || way.id !== id) {
            setWay(get<Way>(id));
        }
    }, [id]);

    function computeStyle() {
        if (!way) {
            return DisabledStyle;
        }

        const relevantIds = [way.id, -way.first.id, ...way.parents.map((p) => p.id)];
        if (relevantIds.includes(hovering)) {
            return HoveredStyle;
        }
        else if (relevantIds.some((id) => excluded.includes(id))) {
            return DisabledStyle;
        }
        else {
            return EnabledStyle;
        }
    }
    
    return way && <Polyline
        positions={way.nodes.map(n => [n.lat, n.lon] as LatLngTuple) ?? []}
        pathOptions={computeStyle()}
    />;
}