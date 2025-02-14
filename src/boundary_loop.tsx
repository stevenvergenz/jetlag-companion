import { ReactNode, useState, useEffect, useContext } from 'react';
import { LatLngBounds, LatLngExpression, LatLngTuple, Map as LMap } from 'leaflet';
import { LayerGroup, Polygon, useMap } from 'react-leaflet';
import Flatbush from 'flatbush';

import { getAsync } from './overpass_api';
import { Relation, Way } from './osm_element';
import { Context } from './context';

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
    searchTree: Flatbush,
    pathSegments: PathSegment[],
    intersections: Map<number, Intersection>,
}

type PathSegment = {
    /** A leg path index */
    start: LatLngTuple,
    /** A leg path index */
    end: LatLngTuple,
    /** The bounding box formed by start and end */
    bounds: [number, number, number, number],
};

type Intersection = {
    segmentIndex: number,
    intersectPoint: LatLngTuple,
}

/** Maximum distance in meters between adjacent ways to be merged */
const MaxDistanceMeters = 500;

const MaxDot = -0.5;

async function generateBoundaryLoopPath(
    included: number[], excluded: number[], map: LMap
): Promise<LatLngTuple[] | undefined> {
    const ids = included.filter(id => !excluded.includes(id));
    const rs = await getAsync('relation', ids);
    return mergeRelations(rs);

    function mergeRelations(relations: Relation[]): LatLngTuple[] | undefined {
        const legs = relations
            .map(r => {
                const path = calcRelationPath(r);
                const pathSegments = [] as PathSegment[];
                const searchTree = new Flatbush(path.length - 1);
                for (let i = 0; i < path.length - 1; i++) {
                    const seg = {
                        start: path[i],
                        end: path[i+1],
                        bounds: [
                            Math.min(path[i][0], path[i+1][0]),
                            Math.min(path[i][1], path[i+1][1]),
                            Math.max(path[i][0], path[i+1][0]),
                            Math.max(path[i][1], path[i+1][1]),
                        ],
                    } as PathSegment;
                    pathSegments.push(seg);
                    searchTree.add(...seg.bounds);
                }
                searchTree.finish();

                return {
                    id: r.id,
                    searchTree,
                    pathSegments,
                    intersections: new Map(),
                } as RelationLeg;
            })
            .reduce((map, leg) => {
                map.set(leg.id, leg);
                return map;
            }, new Map<number, RelationLeg>());

        for (const leg of legs.values()) {
            for (const other of [...legs.values()].filter(o => o.id !== leg.id && !leg.intersections.has(o.id))) {
                for (let i = 0; i < leg.pathSegments.length; i++) {
                    const seg = leg.pathSegments[i];
                    const ids = other.searchTree.search(...seg.bounds);
                    if (ids.length > 1) {
                        console.log('Intersection with more than 1 segment');
                        return undefined;
                    }
                    else if (ids.length === 1) {
                        const otherSeg = other.pathSegments[ids[0]];
                        const intersection = calcIntersection(seg, otherSeg);
                        if (intersection) {
                            leg.intersections.set(other.id, { segmentIndex: i, intersectPoint: intersection });
                            other.intersections.set(leg.id, { segmentIndex: ids[0], intersectPoint: intersection });
                        }
                    }
                }
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
                console.log(`Leg ${id} has ${thisLeg.intersections.size} intersections`);
                return undefined;
            }

            // add from-intersection
            if (!addedIds.has(from)) {
                mergedPath.push(thisLeg.intersections.get(from)!.intersectPoint);
            }

            // add id path
            const nearSegId = thisLeg.intersections.get(from)!.segmentIndex;
            const farLegId = [...thisLeg.intersections.keys()].find(k => k !== from)!;
            const farSegId = thisLeg.intersections.get(farLegId)!.segmentIndex;
            if (nearSegId < farSegId) {
                mergedPath.push(...[
                    ...thisLeg.pathSegments.slice(nearSegId, farSegId).map(s => s.end),
                    thisLeg.pathSegments[farSegId].start,
                ]);
            } else {
                mergedPath.push(...[
                    thisLeg.pathSegments[nearSegId].start,
                    ...thisLeg.pathSegments.slice(farSegId, nearSegId).map(s => s.end).reverse(),
                ]);
            }

            // add to-intersection
            if (!addedIds.has(farLegId)) {
                mergedPath.push(thisLeg.intersections.get(farLegId)!.intersectPoint);
            }
            
            // increment
            addedIds.add(id);
            from = id;
            id = farLegId;
        }

        return mergedPath;
    }

    function calcIntersection(seg1: PathSegment, seg2: PathSegment): LatLngTuple | undefined {
        const [x1, y1] = seg1.start;
        const [x2, y2] = seg1.end;
        const [x3, y3] = seg2.start;
        const [x4, y4] = seg2.end;

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
                const ptScore = Math.max(0, 1 - dist / MaxDistanceMeters);
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
    
        let path = way.children.map(n => [n.lat, n.lon] as LatLngTuple);
        if (way.next) {
            path = path.concat(calcWayGroupPath(way.next).slice(1));
        }
        return path;
    }
}

export function BoundaryLoop(): ReactNode {
    const map = useMap();
    const {
        editingBoundary,
        boundaryReady,
        setBoundary,
        included, excluded,
    } = useContext(Context);
    const [path, setPath] = useState([] as LatLngExpression[][]);

    useEffect(() => {
        async function helper() {
            if (!map || !boundaryReady || included.length === 0) { return; }
            const p = await generateBoundaryLoopPath(included, excluded, map);

            if (!p) {
                console.log('Boundary path not closed');
                return;
            } else {
                console.log(`Boundary path closed with ${p.length} points`);
            }

            setBoundary(p);

            const innerBounds = new LatLngBounds(p);
            const outerBounds = innerBounds.pad(2);
            setPath([
                [
                    outerBounds.getNorthEast(), outerBounds.getNorthWest(),
                    outerBounds.getSouthWest(), outerBounds.getSouthEast(),
                ],
                p,
            ]);
            map.fitBounds(innerBounds, { padding: [0, 0] });
        }
        helper();
    }, [included, excluded, map, boundaryReady, setBoundary]);

    if (!editingBoundary && boundaryReady) {
        return <LayerGroup>
            <Polygon pathOptions={{ color: 'black' }} positions={path} />
        </LayerGroup>;
    }
}