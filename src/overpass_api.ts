import { LatLngTuple } from 'leaflet';
import { Element, Node, Relation, Way } from './osm_element';
import { Id, pack, packFrom, unpack, unreversed } from './id';

const endpoint = 'https://overpass-api.de/api/interpreter';

export const cache = new Map<Id, Element>();

const promises = new Map<Id, Promise<Element[]>>();

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

const QueryLimit = 10 * 1024 * 1024; // 2MB

async function query(query: string): Promise<Element[]> {
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
                // if (id === 'w:909645217') {
                //     console.log('creating', e);
                // }
                cache.set(id, new Way(id, e));
                break;
            case 'node':
                cache.set(id, new Node(id, e));
                break;
        }
    }

    return body.elements.map(e => get(packFrom(e))!);
}

async function getAsyncInternal(ids: Id[]): Promise<Element[]> {
    const promiseIds = ids.filter(id => promises.has(id));
    const queryIdParts = ids
        .filter(id => !cache.has(id) && !promises.has(id))
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

    if (promiseIds.length > 0) {
        await Promise.all(promiseIds.map(id => promises.get(id)).filter(p => p !== undefined));
    }
    
    return ids.map(id => get(id)!);
}

export function getAsync(ids: Id[]): Promise<Element[]> {
    ids = ids.map(id => unreversed(id));
    const queryIds = ids.filter(id => !cache.has(id));
    if (queryIds.length > 0) {
        const p = getAsyncInternal(queryIds)
            .finally(() => {
                for (const id of queryIds) {
                    promises.delete(id);
                }
            });

        for (const id of queryIds) {
            promises.set(id, p);
        }
    }

    return Promise.all(ids.map(async (id) => {
        if (promises.has(id)) {
            return (await promises.get(id)!).find(e => e.id === id)!;
        }
        else {
            return get(id)!;
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

export async function getStations(poly: LatLngTuple[]): Promise<Node[]> {
    const polyStr = poly.flat().join(' ');
    const q = `(
        node[railway=station](poly:"${polyStr}");
        node[highway=bus_stop](poly:"${polyStr}");
    );`;
    return await query(q) as Node[];
}
