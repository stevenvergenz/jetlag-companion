import { LatLngTuple } from 'leaflet';
import { Element, Node, Relation, Way } from './osm_element';

const endpoint = 'https://overpass-api.de/api/interpreter';

const cache: {[type: string]: Map<number, Element>} = {
    'relation': new Map<number, Relation>(),
    'way': new Map<number, Way>(),
    'node': new Map<number, Node>(),
};
const promises = new Map<number, Promise<Element[]>>();

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

const QueryLimit = 10 * 1024 * 1024; // 2MB

async function query(query: string): Promise<Element[]> {
    const res = await fetch(endpoint, {
        method: 'POST',
        body: `[maxsize:${QueryLimit}][out:json]; ${query} out;`,
    });
    const body = await res.json() as OsmQueryResult;

    for (const e of body.elements) {
        switch (e.type) {
            case 'relation':
                cache[e.type].set(e.id, new Relation(e));
                break;
            case 'way':
                cache[e.type].set(e.id, new Way(e));
                break;
            case 'node':
                cache[e.type].set(e.id, new Node(e));
                break;
        }
    }

    return body.elements.map(e => cache[e.type].get(e.id)!);
}

async function getAsyncInternal(type: OsmElementType, ids: number[], recurse = false): Promise<Element[]> {
    const queryIds = ids.filter(id => !cache[type].has(id));
    if (queryIds.length > 0) {
        const recurseQuery = recurse ? '>>;' : '';
        const q = `${type}(id:${queryIds.join(',')}); ${recurseQuery}`;
        await query(q);
    }
    
    return ids.map(id => cache[type].get(id)!);
}

export function getAsync(type: 'relation', ids: number[], recurse?: boolean): Promise<Relation[]>;
export function getAsync(type: 'way', ids: number[], recurse?: boolean): Promise<Way[]>;
export function getAsync(type: 'node', ids: number[], recurse?: boolean): Promise<Node[]>;
export function getAsync(type: OsmElementType, ids: number[], recurse = false): Promise<Element[]> {
    const queryIds = ids.filter(id => !cache[type].has(id) || recurse && !cache[type].get(id)!.complete);
    if (queryIds.length > 0) {
        const p = getAsyncInternal(type, queryIds, recurse)
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
            return cache[type].get(id)!;
        }
    }));
}

export function get(type: 'relation', id: number): Relation | undefined;
export function get(type: 'way', id: number): Way | undefined;
export function get(type: 'node', id: number): Node | undefined;
export function get(type: OsmElementType, id: number): Element | undefined {
    return cache[type].get(id);
}

export async function getStations(poly: LatLngTuple[]): Promise<Node[]> {
    const polyStr = poly.flat().join(' ');
    const q = `(
        node[railway=station](poly:"${polyStr}");
        node[highway=bus_stop](poly:"${polyStr}");
    );`;
    return await query(q) as Node[];
}
