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

export function requestStations(poly: LatLngTuple[], useTransitStations: boolean): Promise<Node[]> {
    const polyStr = poly.flat().join(' ');
    const q = `
        node(poly:"${polyStr}")->.a;
        (
            ${useTransitStations ? 'node.a[public_transport=station][railway=station];' : ''}
        );
    `;
    return query(q).then(ids => ids.map(id => get(id) as Node));
}
