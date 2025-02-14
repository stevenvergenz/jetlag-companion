import { Element, Node, Relation, Way } from './osm_element';

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const LOWER_US = '24.41,-125.51,49.61,-66.09';

const cache = new Map<number, Element>();

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

export async function getAsync<T extends Element>(id: number): Promise<T> {
    if (!cache.has(id)) {
        const res = await fetch(ENDPOINT, {
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
        throw new Error('Element not found');
    } else {
        return cache.get(id) as T;
    }
}


export function get<T extends Element>(id: number): T {
    if (!cache.has(id)) {
        throw new Error('Element not found');
    } else {
        return cache.get(id) as T;
    }
}
