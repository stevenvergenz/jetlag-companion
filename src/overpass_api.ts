import { LatLngTuple } from 'leaflet';
import { Element, Node, Relation, Way } from './element';
import { Id, packFrom, unpack, unreversed } from './id';

const endpoint = 'https://overpass-api.de/api/interpreter';

const reqPromises = new Map<Id, Promise<Element[]>>();

type OsmQueryResult = {
    version: string,
    generator: string,
    elements: OsmElement[],
};

export type OsmElementType = 'relation' | 'way' | 'node' | 'wayGroup';
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

export type OsmWayGroup = OsmCommon & {
    type: 'wayGroup',
    index: number,
}

export type OsmWay = OsmCommon & {
    type: 'way',
    nodes: number[],
};

export type OsmNode = OsmCommon & {
    type: 'node',
    lat: number,
    lon: number,
};

export type OsmElement = OsmRelation | OsmWayGroup | OsmWay | OsmNode;

const QueryLimit = 512 * 1024 * 1024; // 512MB

async function query(query: string): Promise<Element[]> {
    const res = await fetch(endpoint, {
        method: 'POST',
        body: `[maxsize:${QueryLimit}][out:json]; ${query} out;`,
    });
    const body = await res.json() as OsmQueryResult;
    return body.elements.map(e => {
        const id = packFrom(e);
        if (e.type === 'relation') {
            return new Relation(id, e);
        }
        else if (e.type === 'way') {
            return new Way(id, e);
        }
        else if (e.type === 'node') {
            return new Node(id, e);
        }
        else {
            throw new Error(`Unknown element type: ${e.type}`);
        }
    });
}

function requestAsyncInternal(ids: Id[]): Promise<Element[]> {
    const queryIdParts = ids.map(id => unpack(id));

    if (queryIdParts.length > 0) {
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
        return query(q);
    }
    else {
        return Promise.resolve([]);
    }
}

export async function requestAsync(ids: Id[]): Promise<Element[]> {
    ids = ids.map(id => unreversed(id)).filter(id => unpack(id).type !== 'wayGroup');
    const queryIds = ids.filter(id => !reqPromises.has(id));
    if (queryIds.length > 0) {
        const p = requestAsyncInternal(queryIds);
        for (const id of queryIds) {
            reqPromises.set(id, p);
        }
    }

    let items = (await Promise.all(ids.map(id => reqPromises.get(id)!))).flat();
    const ret = [] as Element[];
    for (const id of ids) {
        const e = items.find(e => e.id === id)!;
        if (!e) {
            console.log('Missing element:', id);
        }
        items = items.filter(e => e.id !== id);
        ret.push(e);
    }

    return ret;
}

export function requestTransport(poly: LatLngTuple[]): Promise<Element[]> {
    const polyStr = poly.flatMap(ll => ll.slice(0, 2)).join(' ');
    
    // relation[public_transport=stop_area] describes a group of stops
    //   can have members "platform", "stop_position", "station", etc.
    // nw[public_transport=station] is many:many with stop_areas
    // nw[public_transport=platform] describes a transit stop
    // relation[type=route] describes a route variant going to a platform
    // relation[type=route_master] describes a full route with all variants
    const q = `
        nwr(poly:"${polyStr}") -> .all;
        nw.all[public_transport=platform] -> .platforms;
        nw.all[public_transport=station] -> .stations;
        (
            rel.all(bn.platforms: platform)[public_transport=stop_area];
            rel.all(bw.platforms: platform)[public_transport=stop_area];
        ) -> .areas;
        (
            rel.all(bn.platforms)[type=route];
            rel.all(bw.platforms)[type=route];
        ) -> .routes;
        rel(br.routes)[type=route_master] -> .route_masters;
        (
            .platforms;
            .stations;
            .areas;
            .routes;
            .route_masters;
        );
    `;
    return query(q);
}
