import { Element, Node, Relation, Way } from './osm_element';

const endpoint = 'https://overpass-api.de/api/interpreter';

const cache = new Map<number, Element>();
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

const QueryLimit = 2 * 1024 * 1024; // 2MB

async function getAsyncInternal<T extends Element>(ids: number[], recurse = false): Promise<T[]> {
    const queryIds = ids.filter(id => !cache.has(id));
    if (queryIds.length > 0) {
        const recurseQuery = recurse ? '>>;' : '';
        const res = await fetch(endpoint, {
            method: 'POST',
            body: `[maxsize:${QueryLimit}][out:json]; nwr(id:${queryIds.join(',')}); ${recurseQuery} out;`,
        });
        const body = await res.json() as OsmQueryResult;
        for (const e of body.elements) {
            switch (e.type) {
                case 'relation':
                    cache.set(e.id, new Relation(e));
                    break;
                case 'way':
                    cache.set(e.id, new Way(e));
                    break;
                case 'node':
                    cache.set(e.id, new Node(e));
                    break;
            }
        }
    }
    
    return ids.map(id => cache.get(id) as T);
}

export function getAsync<T extends Element>(ids: number[], recurse = false): Promise<T[]> {
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
            return (await promises.get(id)!).find(e => e.id === id) as T;
        }
        else {
            return cache.get(id) as T;
        }
    }));
}

export function get<T extends Element>(id: number): T | undefined {
    return cache.get(id) as T | undefined;
}
