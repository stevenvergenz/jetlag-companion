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

type GetOptions = {
    request: boolean,
};

type CachedElement = Element | undefined;

/** The elements that have already been loaded */
export const memCacheId = new Map<Id, CachedElement>();
/** The set of element IDs associated with the current boundary */
let memCacheTransport: Set<Id> | undefined;
/** The hash of the current boundary, if any */
let memCacheTransportBounds: string | undefined;

/** In-flight or resolved request promises for an element */
const reqPromises = new Map<Id, Promise<CachedElement[]>>();

const cachePromises = new Map<Id, Promise<CachedElement[]>>();

/** Deferred get requests */
const deferredCallbacks = new Map<Id, (e: CachedElement) => void>();
const deferredPromises = new Map<Id, Promise<CachedElement>>();

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

async function dbPut(db: IDBDatabase, es: CachedElement[], bounds?: string): Promise<void> {
    const tx = db.transaction(['elements', 'transport'], 'readwrite');
    const eStore = tx.objectStore('elements');
    const tStore = tx.objectStore('transport');

    await Promise.all(es
        .map(async (e) => {
            if (!e) return;

            memCacheId.set(e.id, e);
            await dbReq(eStore.put(e.data));

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

            const cb = deferredCallbacks.get(e.id);
            if (cb) {
                console.log('calling deferred get for', e.id);
                cb(e);
                deferredCallbacks.delete(e.id);
            }
        })
    );
}

function dbGetById(db: IDBDatabase, ids: Id[]): Promise<CachedElement[]> {
    const tx = db.transaction('elements', 'readonly');
    const store = tx.objectStore('elements');
    const promises = [] as Promise<Element | undefined>[];

    for (const id of ids) {
        const uid = unpack(id);
        const p = (dbReq(store.get([uid.type, uid.id])) as Promise<OsmElement | undefined>)
            .then(e => {
                if (e?.type === 'node') {
                    const n = new Node(pack(e), e);
                    memCacheId.set(n.id, n);
                    return n;
                }
                else if (e?.type === 'way') {
                    const w = new Way(pack(e), e);
                    memCacheId.set(w.id, w);
                    return w;
                }
                else if (e?.type === 'relation') {
                    const r = new Relation(pack(e), e);
                    memCacheId.set(r.id, r);
                    return r;
                }
            });
        promises.push(p);
    }

    return Promise.all(promises);
}

async function dbGetTransportByBounds(db: IDBDatabase, bounds: string): Promise<(Element | undefined)[]> {
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

/** Generate a promise that will eventually be resolved once the element is fetched and cached */
function getDeferred(id: Id): Promise<Element | undefined> {
    const p = new Promise<Element>((resolve) => {
        deferredCallbacks.set(id, resolve);
    });
    deferredPromises.set(id, p);
    return p;
}

async function requestAndCache(ids: Id[]): Promise<(Element | undefined)[]> {
    const results = new Map<Id, Element>();

    const db = await dbInit();
    const dbEs = await dbGetById(db, ids);
    for (const e of dbEs) {
        results.set(e.id, e);
    }

    const requestIds = ids.filter(id => !results.has(id));
    const reqEs = await requestAsync(requestIds);
    await dbPut(db, reqEs); 

    for (const e of reqEs) {
        results.set(e.id, e);
    }

    db.close();

    return ids.map(id => results.get(id));
}

export async function getAsync(
    ids: Id[],
    { request }: GetOptions = { request: false },
): Promise<(Element | undefined)[]> {
    // unreverse and filter out waygroups
    ids = ids.map(unreversed);

    const promises = [] as Promise<(Element | undefined)>[];
    for (const id of ids) {
        const uid = unpack(id);
        if (memCacheId.has(id)) {
            promises.push(Promise.resolve(memCacheId.get(id) as Element));
        }
        else if (uid.type === 'wayGroup') {
            const parentId = pack({ type: 'relation', id: uid.id });
            promises.push(
                getAsync([parentId], { request }).then(es => {
                    const r = es.find(e => e.id === parentId) as Relation;
                    return r.wayGroups?.get(id);
                })
            );
        }
        else if (reqPromises.has(id)) {
            promises.push(reqPromises.get(id)!.then(es => es.find(e => e.id === id)));
        }
        else if (request) {

        }
    }

    return Promise.all(promises);
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