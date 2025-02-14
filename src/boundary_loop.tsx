import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngTuple, Map as LMap } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';

import { getAsync } from './overpass_api';
import { Relation, Way } from './osm_element';
import { Context } from './context';
import { RTree } from './quadtree';

export const Vec2 = {
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

type WayLeg = {
    id: number,
    termini: { start: Terminus, end: Terminus},
    path: LatLngTuple[],
};

type RelationLeg = {
    id: number,
    searchTree: RTree,
    path: LatLngTuple[],
    intersections: Map<number, [number, number]>,
}

/** Maximum distance in meters between adjacent ways to be merged */
const MaxDistanceMeters = 500;
const MaxDistanceDeg = MaxDistanceMeters / 111320;

const MaxDot = -0.5;

async function generateBoundaryLoopPath(
    included: number[], excluded: number[], map: LMap
): Promise<LatLngTuple[] | undefined> {
    const ids = included.filter(id => !excluded.includes(id));
    const rs = await Promise.all(ids.map(id => getAsync<Relation>(id)));
    return mergeRelations(rs);

    function mergeRelations(relations: Relation[]): LatLngTuple[] | undefined {
        const distanceFn = map.distance.bind(map);
        const legs = relations
            .map(r => {
                const path = calcRelationPath(r);
                return {
                    id: r.id,
                    searchTree: new RTree(path),
                    intersections: new Map(),
                    path,
                } as RelationLeg;
            })
            .reduce((map, leg) => {
                map.set(leg.id, leg);
                return map;
            }, new Map<number, RelationLeg>());


        for (const leg of legs.values()) {
            for (const other of [...legs.values()].filter(l => l.id !== leg.id)) {
                let minIndex = -1;
                let minDist = Infinity;
                for (let i = 0; i < leg.path.length; i++) {
                    const dist = other.searchTree.distance(leg.path[i], distanceFn);
                    if (dist < minDist) {
                        minIndex = i;
                        minDist = dist;
                    }
                }

                if (minDist > MaxDistanceMeters) {
                    continue;
                }
                
                const nextIndex = minIndex + 1;
                const prevIndex = minIndex - 1;
                const nextDist = leg.path[nextIndex]
                    ? other.searchTree.distance(leg.path[nextIndex], distanceFn)
                    : Infinity;
                const prevDist = leg.path[prevIndex] 
                    ? other.searchTree.distance(leg.path[prevIndex], distanceFn) 
                    : Infinity;
                const nextClosest = nextDist < prevDist ? nextIndex : prevIndex;

                leg.intersections.set(other.id, [minIndex, nextClosest]);
            }
        }

        const mergedPath = [] as LatLngTuple[];
        const addedIds = new Set<number>();

        /** The ID of the path being added to the merged path */
        let id = legs.keys().next().value!;
        /** The ID of the previous path to be added, which intersects with id */
        let from = legs.get(id)!.intersections.keys().next().value!;

        while (!addedIds.has(id)) {
            const thisLeg = legs.get(id)!;
            if (thisLeg.intersections.size !== 2 || !thisLeg.intersections.has(from)) {
                return undefined;
            }

            // add from-intersection
            if (!addedIds.has(from) && legs.get(from)?.intersections.has(id)) {
                const fromLeg = legs.get(from)!;
                const intersection = calcIntersection(fromLeg, thisLeg);
                if (intersection) {
                    mergedPath.push(intersection);
                }
            }

            // add id path
            const [nearIndex1, nearIndex2] = thisLeg.intersections.get(from)!;
            const farLegId = [...thisLeg.intersections.keys()].find(k => k !== from)!;
            const [farIndex1, farIndex2] = thisLeg.intersections.get(farLegId)!;
            const ordered = [nearIndex1, nearIndex2, farIndex1, farIndex2].sort();
            const points = nearIndex1 < farIndex1
                ? thisLeg.path.slice(ordered[1], ordered[2] + 1)
                : thisLeg.path.slice(ordered[1], ordered[2] + 1).reverse();
            mergedPath.push(...points);

            // add to-intersection
            if (!addedIds.has(farLegId) && legs.get(farLegId)?.intersections.has(id)) {
                const toLeg = legs.get(farLegId)!;
                const intersection = calcIntersection(toLeg, thisLeg);
                if (intersection) {
                    mergedPath.push(intersection);
                }
            }
            
            // increment
            addedIds.add(id);
            from = id;
            id = farLegId;
        }

        return mergedPath;
    }

    function calcIntersection(leg1: RelationLeg, leg2: RelationLeg): LatLngTuple | undefined {
        const leg1points = leg1.intersections.get(leg2.id)?.map(i => leg1.path[i]);
        const leg2points = leg2.intersections.get(leg1.id)?.map(i => leg2.path[i]);
        if (!leg1points || !leg2points || leg1points.length !== 2 || leg2points.length !== 2) {
            return undefined;
        }

        const [x1, y1] = leg1points[0];
        const [x2, y2] = leg1points[1];
        const [x3, y3] = leg2points[0];
        const [x4, y4] = leg2points[1];

        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        if (denom === 0) {
            return undefined; // Lines are parallel or coincident
        }

        const intersectX = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / denom;
        const intersectY = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / denom;

        return [intersectX, intersectY];
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
                } as WayLeg;
            })
            .reduce((map, leg) => {
                map.set(leg.id, leg);
                return map;
            }, new Map<number, WayLeg>());
    
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
                const ptScore = Math.max(0, 1 - dist / MaxDistanceDeg);
                // more opposing vectors are linearly better than more perpendicular/parallel vectors
                const vecScore = Math.max(0, (dot - MaxDot) / (-1 - MaxDot));
                // distance is more important than orientation
                const score = 0.7 * ptScore + 0.3 * vecScore;
    
                if (score > bestMatch.score) {
                    bestMatch = { end: other, dot, dist, score };
                }
            }
    
            if (bestMatch.end && bestMatch.dist < MaxDistanceMeters && bestMatch.dot < MaxDot) {
                ref.continuedBy = bestMatch.end.id;
                bestMatch.end.continuedBy = ref.id;
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
    const { editingBoundary, included, excluded } = useContext(Context);
    const [path, setPath] = useState([] as LatLngTuple[]);

    useEffect(() => {
        if (!map) { return; }
        generateBoundaryLoopPath(included, excluded, map)
            .then((p) => {
                if (!p) {
                    console.log('Boundary path not closed');
                    return;
                }
                setPath(p);
                map.fitBounds(p);
            });
    }, [included, excluded, map]);

    return <LayerGroup>
        { !editingBoundary && <Polygon pathOptions={{ color: 'green', weight: 5 }} positions={path}/> }
    </LayerGroup>;
}