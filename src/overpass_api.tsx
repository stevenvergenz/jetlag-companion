import { LatLngTuple } from 'leaflet';
import { Element, Node, Relation, Way } from './osm_element';
import { Id, packFrom, unpack } from './id';

const endpoint = 'https://overpass-api.de/api/interpreter';

const cache = new Map<Id, Element>();

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
                cache.set(id, new Way(id, e));
                break;
            case 'node':
                cache.set(id, new Node(id, e));
                break;
        }
    }

    return body.elements.map(e => cache.get(packFrom(e))!);
}

async function getAsyncInternal(ids: Id[], recurse = false): Promise<Element[]> {
    const idParts = ids
        .filter(id => !cache.has(id))
        .map(id => unpack(id))
        .filter(iu => iu.type !== 'wayGroup');
    if (idParts.length > 0) {
        const relationIds = idParts.filter(p => p.type === 'relation').map(p => p.id);
        const wayIds = idParts.filter(p => p.type === 'way').map(p => p.id);
        const nodeIds = idParts.filter(p => p.type === 'node').map(p => p.id);

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
        const recurseQuery = recurse ? '>>;' : '';
        q = `(${q}); ${recurseQuery}`;
        await query(q);
    }
    
    return ids.map(id => cache.get(id)!);
}

export function getAsync(ids: Id[], recurse = false): Promise<Element[]> {
    const queryIds = ids.filter(id => !cache.has(id) || recurse && !cache.get(id)!.complete);
    if (queryIds.length > 0) {
        const p = getAsyncInternal(queryIds, recurse)
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
            return cache.get(id)!;
        }
    }));
}

export function get(id: Id): Element | undefined {
    return cache.get(id);
}

export async function getStations(poly: LatLngTuple[]): Promise<Node[]> {
    const polyStr = poly.flat().join(' ');
    const q = `(
        node[railway=station](poly:"${polyStr}");
        node[highway=bus_stop](poly:"${polyStr}");
    );`;
    return await query(q) as Node[];
}
