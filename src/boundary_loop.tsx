import { ReactNode, useState, useEffect, useContext } from 'react';

import { getAsync } from './overpass_api';
import { Relation, Way } from './osm_element';
import { Context } from './context';
import { LatLngTuple, Map as LMap } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';

const Vec2 = {
    add: (a: LatLngTuple, b: LatLngTuple): LatLngTuple => [a[0] + b[0], a[1] + b[1]],
    sub: (a: LatLngTuple, b: LatLngTuple): LatLngTuple => [a[0] - b[0], a[1] - b[1]],
    scale: (a: LatLngTuple, b: number): LatLngTuple => [a[0] * b, a[1] * b],
    length: (a: LatLngTuple): number => Math.sqrt(a[0] * a[0] + a[1] * a[1]),
    normalize: (a: LatLngTuple): LatLngTuple => Vec2.scale(a, 1 / Vec2.length(a)),
    dot: (a: LatLngTuple, b: LatLngTuple): number => a[0] * b[0] + a[1] * b[1],
    cross: (a: LatLngTuple, b: LatLngTuple): number => a[0] * b[1] - a[1] * b[0],
};

type Terminus = {
    id: number,
    pt: LatLngTuple,
    vec: LatLngTuple,
    continuedBy?: number,
};

type EndpointMatch = {
    end?: Terminus,
    dot: number,
    dist: number,
    score: number,
};

type Leg = {
    id: number,
    termini: { start: Terminus, end: Terminus},
    path: LatLngTuple[],
};

/** Maximum distance in meters between adjacent ways to be merged */
const MaxDistance = 500;

const MaxDot = -0.5;

async function generateBoundaryLoopPath(included: number[], excluded: number[], map: LMap): Promise<LatLngTuple[]> {
    const ids = included.filter(id => !excluded.includes(id));
    const rs = await Promise.all(ids.map(id => getAsync<Relation>(id)));
    return mergeRelations(rs);

    function mergeRelations(relations: Relation[]): LatLngTuple[] {
        let mergedPath = [] as LatLngTuple[];
        for (const r of relations) {
            mergedPath = mergedPath.concat(calcRelationPath(r));
        }
        return mergedPath;
    }
    
    function calcRelationPath(relation: Relation): LatLngTuple[] {
        const legs = relation.wayGroups
            .filter(w => !excluded.includes(-w.id))
            .map(w => {
                const path = calcWayGroupPath(w);
                return {
                    id: w.id,
                    termini: {
                        start: {
                            id: w.id,
                            pt: path[0],
                            vec: Vec2.normalize(Vec2.sub(path[0], path[1])),
                        } as Terminus,
                        end: {
                            id: -w.id,
                            pt: path[path.length - 1],
                            vec: Vec2.normalize(Vec2.sub(path[path.length - 1], path[path.length - 2])),
                        } as Terminus,
                    },
                    path,
                } as Leg;
            })
            .reduce((map, leg) => {
                map.set(leg.id, leg);
                return map;
            }, new Map<number, Leg>());
    
        // compare each end of each way group to every other end and match them by distance and orientation
    
        // for each end of each way group
        const termini = [...legs.values()].map(l => Object.values(l.termini)).flat();
        for (const ref of termini) {
            if (ref.continuedBy) { continue; }
            
            let bestMatch = {
                end: undefined as Terminus | undefined,
                dot: Infinity,
                dist: Infinity,
                score: -Infinity,
            } as EndpointMatch;
    
            // for each end of every other way group
            for (const other of termini.filter(e => e.id !== ref.id && e.id !== -ref.id)) {
                // distance in meters between endpoints (0 is perfect match)
                const dist = map.distance(ref.pt, other.pt);
                // dot product of vectors of the ends (-1 is perfect match)
                const dot = Vec2.dot(ref.vec, other.vec);
    
                // closer points are linearly better than farther points up to the max distance
                const ptScore = Math.max(0, 1 - dist / MaxDistance);
                // more opposing vectors are linearly better than more perpendicular/parallel vectors
                const vecScore = Math.max(0, (dot - MaxDot) / (-1 - MaxDot));
                // distance is more important than orientation
                const score = 0.7 * ptScore + 0.3 * vecScore;
    
                if (score > bestMatch.score) {
                    bestMatch = { end: other, dot, dist, score };
                }
            }
    
            if (bestMatch.end && bestMatch.dist < MaxDistance && bestMatch.dot < MaxDot) {
                console.log(`Matched end ${ref.id} to end ${bestMatch.end.id}`);
                ref.continuedBy = bestMatch.end.id;
                bestMatch.end.continuedBy = ref.id;
            } else {
                console.log(`No match found for end ${ref.id}`);
            }
        }
    
        const mergedPath = [] as LatLngTuple[];
    
        // start with an end that does not continue
        let nextTerminusId = termini.find(e => !e.continuedBy)?.id;
    
        while (nextTerminusId) {
            // the terminus is at the start of a leg
            // so add leg nodes in order and continue with leg end terminus
            if (nextTerminusId > 0) {
                const leg = legs.get(nextTerminusId)!;
                mergedPath.push(...leg.path);
                nextTerminusId = leg.termini.end.continuedBy;
            }
            // the terminus is at the end of a leg
            // so add leg nodes in reverse and continue with leg start terminus
            else {
                const leg = legs.get(-nextTerminusId)!;
                mergedPath.push(...leg.path.reverse());
                nextTerminusId = leg.termini.start.continuedBy;
            }
        }
        
        return mergedPath;
    }
    
    function calcWayGroupPath(way: Way): LatLngTuple[] {
        if (excluded.includes(way.id) && !way.next) {
            return [];
        }
        if (excluded.includes(way.id) && way.next) {
            return calcWayGroupPath(way.next);
        }
    
        let path = way.nodes.map(n => [n.lat, n.lon] as LatLngTuple);
        if (way.next) {
            path = path.concat(calcWayGroupPath(way.next).slice(1));
        }
        return path;
    }
    
}


export function BoundaryLoop(): ReactNode {
    const map = useMap();
    const { included, excluded } = useContext(Context);
    const [path, setPath] = useState([] as LatLngTuple[]);

    useEffect(() => {
        if (!map) { return; }
        generateBoundaryLoopPath(included, excluded, map).then(setPath);
    }, [included, excluded, map]);

    return <LayerGroup>
        <Polygon pathOptions={{ color: 'green', weight: 5 }} positions={path}/>
    </LayerGroup>;
}