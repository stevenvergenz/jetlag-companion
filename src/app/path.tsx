import { ReactNode, useState, useEffect, useContext } from 'react';

import { get } from './overpass_api';
import { Relation, Way, Node } from './osm_element';
import { Polyline } from './lazy';
import { Context } from './context';
import { LatLngTuple } from 'leaflet';

type RelationPathProps = {
    id: number,
};
export function RelationPath({ id }: RelationPathProps): ReactNode {
    const {
        included, excluded, hovering,
    } = useContext(Context);
    const [relation, setRelation] = useState(undefined as Relation | undefined);

    useEffect(() => {
        if (!relation || relation.id !== id) {
            setRelation(get<Relation>(id));
        }
    }, [id]);

    return <>
        { relation?.ways.map(w => <WayPath key={w.id} id={w.id} />) }
    </>;
}

type WayPathProps = {
    id: number,
};
export function WayPath({ id }: WayPathProps): ReactNode {
    const {
        included, excluded, hovering,
    } = useContext(Context);
    const [way, setWay] = useState(undefined as Way | undefined);

    useEffect(() => {
        if (!way || way.id !== id) {
            setWay(get<Way>(id));
        }
    }, [id]);
    
    return <Polyline positions={way?.nodes.map(n => [n.lat, n.lon] as LatLngTuple) ?? []} />
}