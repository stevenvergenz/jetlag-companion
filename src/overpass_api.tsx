import { Element, Node, Relation, Way } from './osm_element';

const endpoint = 'https://overpass-api.de/api/interpreter';

const cache = new Map<number, Element>();
const promises = new Map<number, Promise<Element>>();

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

async function getAsyncInternal<T extends Element>(id: number): Promise<T> {
    if (!cache.has(id)) {
        const res = await fetch(endpoint, {
            method: 'POST',
            body: `[out:json]; nwr(${id}); >>; out;`,
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
    if (!cache.has(id)) {
        throw new Error(`Element not found: ${id}`);
    } else {
        return cache.get(id) as T;
    }
}

export function getAsync<T extends Element>(id: number): Promise<T> {
    if (promises.has(id)) {
        return promises.get(id) as Promise<T>;
    } else {
        const p = getAsyncInternal(id)
            .finally(() => {
                promises.delete(id);
            });
        promises.set(id, p);
        return p as Promise<T>;
    }
}

export function get<T extends Element>(id: number): T {
    if (!cache.has(id)) {
        throw new Error(`Element not found: ${id}`);
    } else {
        return cache.get(id) as T;
    }
}
