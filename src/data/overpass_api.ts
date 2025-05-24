import { Relation, Way, Node } from './index';
import { Id, packFrom, unpack } from './id';

const endpoint = 'https://overpass-api.de/api/interpreter';

type OsmQueryResult = {
    version: string,
    generator: string,
    elements: OsmElement[],
};

export type OsmElementType = 'relation' | 'way' | 'node';
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

export type OsmElement = OsmRelation | OsmWay | OsmNode;

export type QueryElement = Relation | Way | Node;
export type QueryResult = Map<Id, QueryElement | undefined>;

const QueryLimit = 512 * 1024 * 1024; // 512MB

type QueryOptions = {
    idOnly: boolean,
    bbox?: string,
};
const DefaultQueryOptions: QueryOptions = {
    idOnly: false,
    bbox: undefined,
};

async function query(query: string, opts: Partial<QueryOptions> = {}): Promise<QueryResult> {
    opts = { ...DefaultQueryOptions, ...opts };
    const out = opts.idOnly ? 'out ids;' : 'out body;';
    const bbox = opts.bbox ? `[bbox:${opts.bbox}]` : '';
    const res = await fetch(endpoint, {
        method: 'POST',
        body: `[maxsize:${QueryLimit}][out:json]${bbox}; ${query} ${out}`,
    });
    const body = await res.json() as OsmQueryResult;

    const result = new Map<Id, Relation | Way | Node | undefined>();
    for (const e of body.elements) {
        const id = packFrom(e);
        if (opts.idOnly) {
            result.set(id, undefined);
        }
        else if (e.type === 'relation') {
            result.set(id, new Relation(id, e));
        }
        else if (e.type === 'way') {
            result.set(id, new Way(id, e));
        }
        else if (e.type === 'node') {
            result.set(id, new Node(id, e));
        }
    }

    return result;
}

export async function requestAsync(ids: Id[]): Promise<QueryResult> {
    if (ids.length === 0) {
        return new Map();
    }
    
    const queryIdParts = ids.map(id => unpack(id));
    const relationIds = queryIdParts.filter(p => p.type === 'relation').map(p => p.id);
    const wayIds = queryIdParts.filter(p => p.type === 'way').map(p => p.id);
    const nodeIds = queryIdParts.filter(p => p.type === 'node').map(p => p.id);

    let q = '';
    if (relationIds.length > 0) {
        q += `relation(id:${relationIds.join(',')});`;
    }
    if (wayIds.length > 0) {
        q += `way(id:${wayIds.join(',')});`;
    }
    if (nodeIds.length > 0) {
        q += `node(id:${nodeIds.join(',')});`;
    }
    q = `(${q});`;

    const result = await query(q);
    for (const id of ids) {
        if (!result.has(id)) {
            result.set(id, undefined);
        }
    }

    return result;
}

export async function requestTransport(bbox: string): Promise<Id[]> {
    // relation[public_transport=stop_area] describes a group of stops
    //   can have members "platform", "stop_position", "station", etc.
    // nw[public_transport=station] is many:many with stop_areas
    // nw[public_transport=platform] describes a transit stop
    // relation[type=route] describes a route variant going to a platform
    // relation[type=route_master] describes a full route with all variants
    const q = `
    (
        way[public_transport=platform];
        way[public_transport=station];
    ) -> .ways;
    (
        node[public_transport=platform];
        node[public_transport=station];
        node(w.ways);
        .ways;
        rel[public_transport=stop_area];
        rel[type=route];
        rel[type=route_master];
    );`;
    const map = await query(q, { idOnly: true, bbox });
    return [...map.keys()];
}
