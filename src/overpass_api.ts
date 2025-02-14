import { LatLngTuple } from 'leaflet';
import { Element, Node, Relation, Way } from './osm_element';
import { Id, pack, packFrom, unpack, unreversed } from './id';

const endpoint = 'https://overpass-api.de/api/interpreter';

export const cache = new Map<Id, Element>();

const reqPromises = new Map<Id, Promise<void>>();
const getPromises = new Map<Id, Promise<Element>>();
const getCallbacks = new Map<Id, (e: Element) => void>();

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

async function query(query: string): Promise<Id[]> {
    const res = await fetch(endpoint, {
        method: 'POST',
        body: `[maxsize:${QueryLimit}][out:json]; ${query} out;`,
    });
    const body = await res.json() as OsmQueryResult;

    for (const e of body.elements) {
        const id = packFrom(e);
        switch (e.type) {
            case 'relation':
                cache.set(id, new Relation(id, e));
                break;
            case 'way':
                cache.set(id, new Way(id, e));
                break;
            case 'node':
                cache.set(id, new Node(id, e));
                break;
        }
        getCallbacks.get(id)?.(cache.get(id)!);
    }

    return body.elements.map(e => packFrom(e));
}

async function requestAsyncInternal(ids: Id[]): Promise<void> {
    const queryIdParts = ids
        .map(id => unpack(id))
        .filter(iu => iu.type !== 'wayGroup');
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
        await query(q);
    }
}

export function requestAsync(...ids: Id[]): Promise<Element[]> {
    ids = ids.map(id => unreversed(id));
    const queryIds = ids.filter(id => !reqPromises.has(id));
    if (queryIds.length > 0) {
        const p = requestAsyncInternal(queryIds);
        for (const id of queryIds) {
            reqPromises.set(id, p);
        }
    }

    return getAsync(...ids);
}

export function getAsync(...ids: Id[]): Promise<Element[]> {
    return Promise.all(ids.map(id => {
        if (getPromises.has(id)) {
            return getPromises.get(id)!;
        }
        else if (reqPromises.has(id)) {
            const p = reqPromises.get(id)!.then(() => get(id)!);
            getPromises.set(id, p);
            return p;
        }
        else {
            const p = new Promise<Element>((resolve) => {
                getCallbacks.set(id, resolve);
            });
            getPromises.set(id, p);
            return p;
        }
    }));
}

export function get(id: Id): Element | undefined {
    const idu = unpack(id);
    if (idu.type === 'wayGroup') {
        const parentId = pack({ type: 'relation', id: idu.id });
        return (get(parentId) as Relation | undefined)?.wayGroups.get(id);
    }
    else {
        return cache.get(unreversed(id));
    }
}

const stationCache = new Map<string, Id[]>();

export async function requestStations(
    poly: LatLngTuple[], 
    useTransitStations: boolean, 
    busTransferThreshold: number,
): Promise<Node[]> {
    const polyStr = poly.flat().map(n => n?.toPrecision(6)).join(' ');
    
    let ids: Id[] = [];
    if (!stationCache.has(polyStr)) {
        // relation[public_transport=stop_area] describes a group of stops
        //   can have members "platform", "stop_position", "station", etc.
        // nw[public_transport=station] is many:many with stop_areas
        // nw[public_transport=platform] describes a transit stop
        // relation[type=route] describes a route variant going to a platform
        // relation[type=route_master] describes a full route with all variants
        const q = `
            nwr(poly:"${polyStr}") -> .all;
            rel.all[public_transport=stop_area] -> .areas;
            way(r.areas: platform) -> .platform_ways;
            node(r.areas: platform) -> .platform_nodes;
            way.all[public_transport=station] -> .station_ways;
            node.all[public_transport=station] -> .station_nodes;
            (
                rel(bw.platform_ways: platform)[type=route];
                rel(bn.platform_nodes: platform)[type=route];
            ) -> .routes;
            rel(br.routes)[type=route_master] -> .route_masters;
            
            (
                .areas;
                .platform_ways;
                .platform_nodes;
                .station_ways;
                .station_nodes;
                .routes;
                .route_masters;
            );
        `;
        ids = (await query(q)).filter(id => unpack(id).type === 'node');
        stationCache.set(polyStr, ids);
    }
    else {
        ids = stationCache.get(polyStr)!;
    }

    const nodes = ids
        .map(id => get(id) as Node);
    return nodes.filter(n =>
            useTransitStations && n.isStation
            || n.isBusStop && n.busRoutes.length >= busTransferThreshold);
}
