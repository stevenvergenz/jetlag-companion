import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, LatLngBounds, PathOptions } from 'leaflet';
import { LayerGroup, Polyline, useMap } from 'react-leaflet';

import { Id, Relation, Run, Way, Node } from './data/index';
import { getAsync, get } from './util/overpass_cache';
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
/*
export function BoundaryLayer(): ReactNode {
    const { boundaryEditing, boundaryIncluded, boundaryExcluded } = useContext(SharedContext);
    const notBoundaryExcluded = notExcluded(boundaryExcluded);
    const map = useMap();

    useEffect(() => {
        getAsync([...boundaryIncluded].filter(notBoundaryExcluded))
        .then(rs => Promise.all(rs.map(r => Run.generateFromRelation(r as Relation))))
        .then(() => {
            const relations = [...boundaryIncluded].flatMap(id => {
                if (notBoundaryExcluded(id)) {
                    return [get(id, Relation)!];
                } else {
                    return [];
                }
            });
            const runs = relations.flatMap(rel => {
                return rel.childrenOfType(Run).filter(run => notBoundaryExcluded(run.id));
            });
            const ways = runs.flatMap(run => {
                return run.childrenOfType(Way).filter(way => notBoundaryExcluded(way.id));
            });

            return getAsync(ways.flatMap(w => w.childRefs.map(r => r.id))) as Promise<Node[]>;
        })
        .then(nodes => {
            const bounds = new LatLngBounds(nodes.map(n => [n.lat, n.lon]));
            if (bounds.isValid()) {
                map.fitBounds(bounds, { padding: [0, 0] });
            }
        });
    }, [boundaryIncluded, boundaryExcluded, notBoundaryExcluded, map, boundaryEditing]);

    if (boundaryEditing) {
        return <LayerGroup>
            {[...boundaryIncluded].filter(notBoundaryExcluded).map(id => <RelationPath key={id} relation= />)}
        </LayerGroup>;
    }
}

type WayPathProps = {
    way: Way,
};
export function WayPath({ way }: WayPathProps): ReactNode {
    const {
        boundaryExcluded, boundaryErrors,
        hovering,
    } = useContext(SharedContext);
    const [renderOptions, setRenderOptions] = useState(DisabledStyle as PathOptions);

    const relevantIds = [way.id, ...way.parentsOfType(Run).map(r => r.id), ...way.parents.flatMap(wg => [...wg.parentIds])];
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
    
    return <Polyline
        positions={way.children.map(n => [n.lat, n.lon] as LatLngTuple) ?? []}
        pathOptions={renderOptions}
    />;
}
    */