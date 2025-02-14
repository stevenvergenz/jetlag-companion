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
        relation
            [type=route]
            ["description" ~ "${pattern}"];
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
    const ways = await req<OsmWay>(waysQuery);
    let wayIds = ways.elements.reduce((set, w) => {
        set.add(w.id);
        return set;
    }, new Set<number>());

    let nodeIds = [] as number[];
    const starts = ways.elements.map(w => w.nodes[0]);
    const ends = ways.elements.map(w => w.nodes[w.nodes.length - 1]);
    let wayIndex = starts.findIndex(s => !ends.includes(s));
    while (wayIndex !== -1) {
        console.log('Adding nodes', ways.elements[wayIndex].nodes);
        wayIds.delete(ways.elements[wayIndex].id);
        if (nodeIds.length === 0) {
            nodeIds.push(...ways.elements[wayIndex].nodes);
        } else {
            nodeIds.push(...ways.elements[wayIndex].nodes.slice(1));
        }
        wayIndex = starts.findIndex(s => s === nodeIds[nodeIds.length - 1]);
    }

    console.log('Discontinuous ways:', wayIds);

    const nodesQuery = `
        [out:json];
        node(id:${nodeIds.join(',')});
        out;`
    const nodes = await req<OsmNode>(nodesQuery);
    const nodeLookup: Map<number, OsmNode> = nodes.elements.reduce((map, n) => {
        map.set(n.id, n);
        return map;
    }, new Map());
    return nodeIds.map(id => nodeLookup.get(id) as OsmNode);
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