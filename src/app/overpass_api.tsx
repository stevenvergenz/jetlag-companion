import { Boundary } from "./boundaries";

type OsmQueryResult<T extends OsmCommon> = {
    version: string,
    generator: string,
    elements: T[],
};

type OsmElementType = 'relation' | 'way' | 'node';
type OsmCommon = {
    type: OsmElementType,
    id: number,
    tags?: { [key: string]: string },
};

export type OsmRelation = OsmCommon & {
    type: 'relation',
    members: OsmMember[],
};

type OsmMember = {
    type: OsmElementType,
    ref: number,
    role: string,
};

export type OsmWay = OsmCommon & {
    type: 'way',
    nodes: number[],
};

export type OsmNode = OsmCommon & {
    type: 'node',
    lat: number,
    lon: number,
};

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

function req<T extends OsmCommon>(query: string): Promise<OsmQueryResult<T>> {
    return fetch(ENDPOINT, { method: 'POST', body: query })
        .then(res => res.json() as Promise<OsmQueryResult<T>>);
}

export async function search_road(pattern: string): Promise<OsmRelation[]> {
    const query = `
        [out:json];
        relation[type=route](24.41,-125.51,49.61,-66.09);
        (
            relation["name" ~ "${pattern}"];
        );
        out;
        `;

    const res = await req<OsmRelation>(query);
    return res.elements;
}

export async function get_road_path(b: Boundary): Promise<OsmNode[]> {
    const waysQuery = `
        [out:json];
        relation
            (${b.id});
        way(r);
        out;`;
    const waysReq = await req<OsmWay>(waysQuery);

    let ways = waysReq.elements.reduce((map, w) => {
        map.set(w.id, w.nodes);
        return map;
    }, new Map<number, number[]>());
    const ends = waysReq.elements.reduce((map, w) => {
        map.set(w.nodes[w.nodes.length - 1], w.id);
        return map;
    }, new Map<number, number>());

    // merge all the ways that share start/end nodes
    let unstable = true;
    while (unstable) {
        unstable = false;
        for (const wayId of ways.keys()) {
            let nodeIds = ways.get(wayId) as number[];
            const preceding = ends.get(nodeIds[0]);
            if (preceding) {
                let pNodes = ways.get(preceding) as number[];
                ends.delete(pNodes[pNodes.length - 1]);
                pNodes.push(...nodeIds.slice(1));
                ways.set(preceding, pNodes);
                ends.set(pNodes[pNodes.length - 1], preceding);
                ways.delete(wayId);
                unstable = true;
            }
        }
    }

    const nodeIds = [...ways.values()].flat();
    const nodesQuery = `
        [out:json];
        node(id:${nodeIds.join(',')});
        out;`
    const nodes = await req<OsmNode>(nodesQuery);
    const nodeLookup: Map<number, OsmNode> = nodes.elements.reduce((map, n) => {
        map.set(n.id, n);
        return map;
    }, new Map());

    // merge ways if start and end nodes are close together
    unstable = ways.size > 1;
    while (unstable) {
        unstable = false;
        for (const wayId of ways.keys()) {
            let nodeIds = ways.get(wayId) as number[];

            const startLatLng = {
                lat: nodeLookup.get(nodeIds[0])?.lat as number,
                lng: nodeLookup.get(nodeIds[0])?.lon as number,
            } satisfies google.maps.LatLngLiteral;
            let closestId = undefined;
            let closeness = Infinity;

            for (const [otherId, otherNodeIds] of ways) {
                if (otherId === wayId) {
                    continue;
                }
                const otherLatLng = {
                    lat: nodeLookup.get(otherNodeIds[otherNodeIds.length - 1])?.lat as number,
                    lng: nodeLookup.get(otherNodeIds[otherNodeIds.length - 1])?.lon as number,
                } satisfies google.maps.LatLngLiteral;
                const dist = google.maps.geometry.spherical.computeDistanceBetween(
                    startLatLng,
                    otherLatLng,
                );
                console.log(`${otherId} -> ${wayId} = ${dist}`);
                if (dist < closeness) {
                    closeness = dist;
                    closestId = otherId;
                }
            }

            if (closestId !== undefined && closeness < 500) {
                let pNodes = ways.get(closestId) as number[];
                ends.delete(pNodes[pNodes.length - 1]);
                pNodes.push(...nodeIds);
                ways.set(closestId, pNodes);
                ends.set(pNodes[pNodes.length - 1], closestId);
                ways.delete(wayId);
                unstable = true;
            }
        }
    }
    
    console.log('ways', ways);
    return [...ways.values()][0].map(id => nodeLookup.get(id) as OsmNode);
}

export function member_roles(relation: OsmRelation | undefined): string[] {
    if (!relation) {
        return [];
    }

    return [...relation.members.reduce((set, m) => {
        set.add(m.role);
        return set;
    }, new Set<string>())];
}