import { ReactNode, useState, useEffect, useContext, useRef } from 'react';

import { get, getAsync } from './overpass_api';
import { Relation, Way } from './osm_element';
import { Context } from './context';
import { LatLngTuple, LatLngBounds, PathOptions,
    FeatureGroup as FeatureGroupType, Polyline as PolylineType } from 'leaflet';
import { FeatureGroup, Polyline, useMap } from 'react-leaflet';

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
    const { included, excluded } = useContext(Context);
    const map = useMap();
    const layerRef = useRef(null as FeatureGroupType | null);

    useEffect(() => { recalcBounds(); }, [included, excluded, map, layerRef.current]);

    async function recalcBounds() {
        if (!map || !layerRef.current) { return; }
        
        console.log('Updating bounds');

        const bounds = new LatLngBounds(
            // loaded enabled relations
            (await Promise.all(
                included
                    .filter(id => !excluded.includes(id))
                    .map(id => getAsync<Relation>(id))
            ))
            // enabled ways
            .map(r => r.ways)
            .flat()
            .filter(w => !excluded.includes(w.id) && !excluded.includes(-w.first.id))
            // nodes
            .map(w => w.nodes)
            .flat()
            // convert to LatLngTuple
            .map(n => [n.lat, n.lon] as LatLngTuple)
        );

        if (bounds.isValid()) {
            map.fitBounds(bounds);
        }
    }

    return <FeatureGroup ref={layerRef} interactive={false}>
        {included.map(id => <RelationPath key={`rp${id}`} id={id} />)}
    </FeatureGroup>;
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