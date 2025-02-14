import { LatLngTuple } from 'leaflet';
import { Id, pack, unpack, unreversed } from './id';
import { Element, Node, Relation, Way, WayGroup } from './element';
import { OsmElement, OsmElementType, requestAsync, requestTransport } from './overpass_api';

type TransportType = 'platform' | 'station' | 'stop_area' | 'route' | 'route_master';

type TransportDbItem = {
    bounds: string,
    transportType: TransportType,
    type: OsmElementType,
    id: number,
};

export const memCacheId = new Map<Id, Element>();
let memCacheTransport: Set<Id> | undefined;
let memCacheTransportBounds: string | undefined;
const getPromises = new Map<Id, Promise<Element[]>>();
const getCallbacks = new Map<Id, (e: Element[]) => void>();

function dbReq<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function dbInit(): Promise<IDBDatabase> {
    const req = indexedDB.open('overpass-cache', 1);

    req.addEventListener('upgradeneeded', () => {
        req.result.createObjectStore('elements', { keyPath: ['type', 'id'] });
        const tstore = req.result.createObjectStore('transport', { keyPath: ['bounds', 'type', 'id']});
        tstore.createIndex('bounds', 'bounds', { unique: false });
    });

    return await dbReq(req);
}

async function dbPut(db: IDBDatabase, es: Element[], bounds?: string): Promise<void> {
    const tx = db.transaction(['elements', 'transport'], 'readwrite');
    const eStore = tx.objectStore('elements');
    const tStore = tx.objectStore('transport');

    await Promise.all(es
        .map(async (e) => {
            if (!(e instanceof WayGroup)) {
                memCacheId.set(e.id, e);
                await dbReq(eStore.put(e.data));
            }

            if (bounds && e.data.tags && (
                e.data.tags.public_transport 
                || ['route', 'route_master'].includes(e.data.tags.type)
            )) {
                if (memCacheTransportBounds !== bounds) {
                    memCacheTransportBounds = bounds;
                    memCacheTransport = new Set<Id>();
                }

                const tType = (e.data.tags.public_transport ?? e.data.tags.type) as TransportType;
                memCacheTransport?.add(e.id);
                    
                await dbReq(tStore.put({
                    bounds, 
                    transportType: tType, 
                    type: e.data.type,
                    id: e.data.id,
                } satisfies TransportDbItem));
            }

            getCallbacks.get(e.id)?.([e]);
            getCallbacks.delete(e.id);
        })
    );
}

async function dbGetById(db: IDBDatabase, ids: Id[]): Promise<Element[]> {
    const tx = db.transaction('elements', 'readonly');
    const store = tx.objectStore('elements');

    await Promise.all(ids
        .filter(id => !memCacheId.has(id))
        .map(id => unpack(id))
        .map(async (uid) => {
            const e = await dbReq(store.get([uid.type, uid.id])) as OsmElement | undefined;

            if (e?.type === 'node') {
                const n = new Node(pack(e), e);
                memCacheId.set(n.id, n);
            }
            else if (e?.type === 'way') {
                const w = new Way(pack(e), e);
                memCacheId.set(w.id, w);
            }
            else if (e?.type === 'relation') {
                const r = new Relation(pack(e), e);
                memCacheId.set(r.id, r);
            }
        })
    );

    return ids.map(id => memCacheId.get(id)).filter(e => e !== undefined) as Element[];
}

async function dbGetTransportByBounds(db: IDBDatabase, bounds: string): Promise<Element[]> {
    const tx = db.transaction(['transport', 'elements'], 'readonly');
    const tStore = tx.objectStore('transport');

    let ids = [] as Id[];
    if (memCacheTransportBounds !== undefined && memCacheTransportBounds === bounds && memCacheTransport) {
        ids = [...memCacheTransport];
    }
    else {
        const items = await dbReq(tStore.index('bounds').getAll(bounds)) as TransportDbItem[];
        ids = items.map(item => pack({ type: item.type, id: item.id }));
    }

    return await dbGetById(db, ids);
}

function getDeferred(id: Id): Promise<Element[]> {
    return new Promise((resolve) => {
        getCallbacks.set(id, resolve);
    });
}

async function getInternalAsync(ids: Id[], { request }: { request: boolean }): Promise<Element[]> {
    const db = await dbInit();

    const dbEs = await dbGetById(db, ids);
    const results = dbEs.reduce((map, e) => {
        map.set(e.id, e);
        return map;
    }, new Map<Id, Element>());

    const requestIds = ids.filter(id => !results.has(id));
    let reqEs: Element[];
    if (request) {
        const p = requestAsync(requestIds);
        for (const id of requestIds) {
            getPromises.set(id, p);
        }
        reqEs = await p;
        await dbPut(db, reqEs); 
    }
    else {
        for (const id of requestIds) {
            getPromises.set(id, getDeferred(id));
        }
        reqEs = (await Promise.all(requestIds.map(id => getPromises.get(id)!))).flat();
    }

    db.close();

    for (const e of reqEs) {
        results.set(e.id, e);
    }

    return ids.map(id => results.get(id)!);
}

export async function getAsync(ids: Id[], options = { request: false }): Promise<Element[]> {
    ids = ids.map(unreversed);
    const lookupIds = ids.filter(id => !getPromises.has(id) && unpack(id).type !== 'wayGroup');

    if (lookupIds.length > 0) {
        const p = getInternalAsync(lookupIds, options);
        for (const id of lookupIds) {
            getPromises.set(id, p);
        }
    }

    await Promise.all(
        ids.map(id => getPromises.get(id)!)
    );

    return ids.map(id => get(id)!);
}

export function get(id: Id): Element | undefined {
    const idu = unpack(id);
    if (idu.type === 'wayGroup') {
        const parentId = pack({ type: 'relation', id: idu.id });
        return (get(parentId) as Relation | undefined)?.wayGroups?.get(id);
    }
    else {
        return memCacheId.get(unreversed(id));
    }
}

export async function getByTransportTypeAsync<T extends Element>(
    bounds: LatLngTuple[], 
    transportType: TransportType, 
    { request } = { request: false },
): Promise<T[]> {
    const cleanBounds = bounds.flatMap(b => b.slice(0, 2)).map(n => n?.toFixed(4)).join(' ');
    const rawBuf = Uint8Array.from(cleanBounds.split('').map(c => c.charCodeAt(0)));
    const cleanBoundsBuf = (await window.crypto.subtle.digest('SHA-256', rawBuf));
    const cleanBoundsHash = [...new Uint8Array(cleanBoundsBuf)]
        .map(n => `00${n.toString(16)}`.substring(n < 16 ? 1 : 2)).join('');

    const db = await dbInit();

    let es = await dbGetTransportByBounds(db, cleanBoundsHash);
    if (request && es.length === 0) {
        es = await requestTransport(cleanBounds);
        await dbPut(db, es, cleanBoundsHash);
    }

    db.close();
    return es.filter(e => 
        e.data.tags?.public_transport === transportType || e.data.tags?.type === transportType) as T[];
}