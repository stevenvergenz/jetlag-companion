import Flatbush from 'flatbush';
import { LatLngTuple } from 'leaflet';

import { getAsync, memCacheId } from './overpass_cache';
import { Id, Relation, Run, Way, Node } from '../data/index';

export const Vec2 = {
    add: (a: LatLngTuple, b: LatLngTuple): LatLngTuple => [a[0] + b[0], a[1] + b[1]],
    sub: (a: LatLngTuple, b: LatLngTuple): LatLngTuple => [a[0] - b[0], a[1] - b[1]],
    scale: (a: LatLngTuple, b: number): LatLngTuple => [a[0] * b, a[1] * b],
    length: (a: LatLngTuple): number => Math.sqrt(a[0] * a[0] + a[1] * a[1]),
    normalize: (a: LatLngTuple): LatLngTuple => Vec2.scale(a, 1 / Vec2.length(a)),
    dot: (a: LatLngTuple, b: LatLngTuple): number => a[0] * b[0] + a[1] * b[1],
    cross: (a: LatLngTuple, b: LatLngTuple): number => a[0] * b[1] - a[1] * b[0],
};

type DistanceFn = (a: LatLngTuple, b: LatLngTuple) => number;

type Terminus = {
    id: Id,
    direction: 'forward' | 'backward',
    pt: LatLngTuple,
    vec: LatLngTuple,
    continuedBy?: Terminus,
};

type EndpointMatch = {
    end?: Terminus,
    dot: number,
    dist: number,
    score: number,
};

type WayLeg = {
    id: Id,
    termini: { start: Terminus, end: Terminus},
    path: LatLngTuple[],
};

type RelationLeg = {
    id: Id,
    searchTree: Flatbush,
    pathSegments: PathSegment[],
    intersections: Map<Id, Intersection>,
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

export async function generateBoundaryLoopPath(
    included: Set<Id>, excluded: Set<Id>, distanceFn: DistanceFn,
): Promise<LatLngTuple[] | undefined> {
    const relations = await getAsync(
        [...included]
        .filter(id => !excluded.has(id))
    ) as Relation[];

    const ways = await getAsync(
        relations.flatMap(r => r.childRefsOfType('way').map(ref => ref.id).filter(id => !excluded.has(id))));

    await getAsync(ways.flatMap(w => w?.childRefs.map(ref => ref.id) ?? []));

    for (const r of relations) {
        const runs = Run.generateFromRelation(r);
        for (const run of runs) {
            memCacheId.set(run.id, run);
        }
    }

    return mergeRelations(relations, excluded, distanceFn);
}

export function mergeRelations(
    relations: Relation[], excluded: Set<Id>, distanceFn: DistanceFn,
): LatLngTuple[] | undefined {
    if (relations.length === 1) {
        const path = calcRelationPath(relations[0], excluded, distanceFn);
        if (path[0].every((c, i) => path[path.length - 1][i] === c)) {
            return path;
        }
    }

    const legs = relations
        .map(r => {
            const path = calcRelationPath(r, excluded, distanceFn);
            const pathSegments = [] as PathSegment[];
            const searchTree = new Flatbush(path.length - 1);
            for (let j = 0; j < path.length - 1; j++) {
                const seg = {
                    start: path[j],
                    end: path[j+1],
                    bounds: [
                        Math.min(path[j][0], path[j+1][0]),
                        Math.min(path[j][1], path[j+1][1]),
                        Math.max(path[j][0], path[j+1][0]),
                        Math.max(path[j][1], path[j+1][1]),
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
        }, new Map<Id, RelationLeg>());

    for (const leg of legs.values()) {
        for (const other of [...legs.values()].filter(o => o.id !== leg.id && !leg.intersections.has(o.id))) {
            for (let i = 0; i < leg.pathSegments.length; i++) {
                const seg = leg.pathSegments[i];
                const ids = other.searchTree.search(...seg.bounds);
                if (ids.length > 1) {
                    throw new BoundaryError('More than one intersection', [leg.id, other.id]);
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
    const addedIds = new Set<Id>();

    /** The ID of the path being added to the merged path */
    let id = legs.keys().next().value!;
    /** The ID of the previous path to be added, which intersects with id */
    let from = legs.get(id)!.intersections.keys().next().value!;

    while (!addedIds.has(id)) {
        const thisLeg = legs.get(id)!;
        if (thisLeg.intersections.size !== 2 || !thisLeg.intersections.has(from)) {
            console.log(`[boundary] Leg ${id} has ${thisLeg.intersections.size} intersections`);
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
                //thisLeg.pathSegments[farSegId].start,
            ]);
        } else {
            mergedPath.push(...[
                //thisLeg.pathSegments[nearSegId].start,
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

export function calcIntersection(seg1: PathSegment, seg2: PathSegment): LatLngTuple | undefined {
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

export function calcRelationPath(relation: Relation, excluded: Set<Id>, distanceFn: DistanceFn): LatLngTuple[] {
    const runs = relation.childrenOfType(Run).filter(r => !excluded.has(r.id));
    const legs: Map<Id, WayLeg> = runs
        .map(wg => {
            const path = calcRunPath(wg, excluded);
            return {
                id: wg.id,
                termini: {
                    start: {
                        id: wg.id,
                        direction: 'forward',
                        pt: path[0],
                        vec: Vec2.normalize(Vec2.sub(path[0], path[1])),
                    } satisfies Terminus,
                    end: {
                        id: wg.id,
                        direction: 'backward',
                        pt: path[path.length - 1],
                        vec: Vec2.normalize(Vec2.sub(path[path.length - 1], path[path.length - 2])),
                    } satisfies Terminus,
                },
                path,
            };
        })
        .reduce((map, leg) => {
            map.set(leg.id, leg);
            return map;
        }, new Map<Id, WayLeg>());
    console.log(`[boundary] Relation ${relation.id} has ${legs.size} legs`);

    // compare each end of each way group to every other end and match them by distance and orientation

    // for each end of each way group
    const termini = [...legs.values()].map(l => Object.values(l.termini)).flat();
    for (const ref of termini) {
        if (ref.continuedBy) { continue; }
        
        let bestMatch: EndpointMatch = {
            end: undefined,
            dot: Infinity,
            dist: Infinity,
            score: -Infinity,
        };

        // for each end of every other way group
        for (const other of termini.filter(e => e.id !== ref.id)) {
            // distance in meters between endpoints (0 is perfect match)
            const dist = distanceFn(ref.pt, other.pt);
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

        if (bestMatch.end && bestMatch.dist <= MaxDistanceMeters && bestMatch.dot <= MaxDot) {
            console.log('[boundary] match found', bestMatch.end, ref);
            ref.continuedBy = bestMatch.end;
            bestMatch.end.continuedBy = ref;
        }
    }

    const mergedPath = [] as LatLngTuple[];

    // start with an end that does not continue
    let nextTerminus = termini.find(e => !e.continuedBy);
    while (nextTerminus) {
        // the terminus is at the start of a leg
        // so add leg nodes in order and continue with leg end terminus
        if (nextTerminus.direction === 'forward') {
            const leg = legs.get(nextTerminus.id)!;
            mergedPath.push(...leg.path);
            nextTerminus = leg.termini.end.continuedBy;
        }
        // the terminus is at the end of a leg
        // so add leg nodes in reverse and continue with leg start terminus
        else {
            const leg = legs.get(nextTerminus.id)!;
            mergedPath.push(...leg.path.reverse());
            nextTerminus = leg.termini.start.continuedBy;
        }
    }
    
    return mergedPath;
}

export function calcRunPath(run: Run, excluded: Set<Id>): LatLngTuple[] {
    const mergedPath = [] as LatLngTuple[];
    for (const wayRef of run.childRefsOfType(Way).filter(w => !excluded.has(w.id))) {
        let path = calcWayPath(wayRef.element);
        if (wayRef.role === Run.reverseRole) {
            path = path.reverse();
        }
        mergedPath.push(...path.slice(mergedPath.length > 0 ? 1 : 0))
    }

    return mergedPath;
}

export function calcWayPath(way: Way): LatLngTuple[] {
    return way.childrenOfType(Node).map(n => [n.lat, n.lon] as LatLngTuple);
}

export class BoundaryError extends Error {
    public constructor(message: string, public relevantIds: Id[]) {
        super(message);
    }
}