import { LatLngTuple } from 'leaflet';

import { Id, pack, unpack } from '../data/id';
import { Element, ElementCtor, Node, Relation, Way } from '../data/index';
import { QueryElement, QueryResult, OsmElement, OsmElementType, requestAsync, requestTransport } from '../data/overpass_api';

type TransportType = 'platform' | 'station' | 'stop_area' | 'route' | 'route_master' | undefined;

type TransportDbItem = {
    bounds: string,
    transportType: TransportType,
    type: OsmElementType,
    id: number,
};

/** The elements that have already been loaded */
export const memCacheId = new Map<Id, QueryElement>();
/** The set of element IDs associated with the current boundary */
let memCacheTransport: Set<Id> | undefined;
/** The hash of the current boundary, if any */
let memCacheTransportBounds: string | undefined;

/** In-flight or resolved request promises for an element */
const reqPromises = new Map<Id, Promise<QueryElement | undefined>>();
const cachePromises = new Map<Id, Promise<QueryElement | undefined>>();

/** Deferred get requests */
const deferredCallbacks = new Map<Id, (e: QueryElement) => void>();
const deferredPromises = new Map<Id, Promise<QueryElement>>();

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

type ClearOptions = {
    clearMem: boolean,
    clearCache: boolean,
};
const DefaultClearOptions: ClearOptions = { clearMem: true, clearCache: true };

export async function dbClear(opts: Partial<ClearOptions> = {}): Promise<void> {
    const { clearMem, clearCache } = { ...DefaultClearOptions, ...opts };
    
    if (clearMem) {
        memCacheId.clear();
        memCacheTransport = undefined;
        memCacheTransportBounds = undefined;
    }

    if (clearCache) {
        const db = await dbInit();
        const tx = db.transaction(['transport', 'elements'], 'readwrite');
        const eStore = tx.objectStore('elements');
        const tStore = tx.objectStore('transport');
        await Promise.all([dbReq(eStore.clear()), dbReq(tStore.clear())]);
        db.close();
    }
}

async function dbPut(tx: IDBTransaction, e: QueryElement, bounds?: string): Promise<void> {
    const eStore = tx.objectStore('elements');
    const tStore = tx.objectStore('transport');

    memCacheId.set(e.id, e);
    await dbReq(eStore.put(e.data));

    if (bounds) {
        if (memCacheTransportBounds !== bounds) {
            memCacheTransportBounds = bounds;
            memCacheTransport = new Set<Id>();
        }

        const tType = (e.data.tags?.public_transport ?? e.data.tags?.type) as TransportType;
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
        console.log('[load] calling deferred get for', e.id);
        cb(e);
        deferredCallbacks.delete(e.id);
        deferredPromises.delete(e.id);
    }
}

async function dbPutAll(db: IDBDatabase, es: QueryResult, bounds?: string): Promise<void> {
    const tx = db.transaction(['elements', 'transport'], 'readwrite');
    await Promise.all([...es.values()]
        .filter(e => e !== undefined)
        .map(e => dbPut(tx, e, bounds)));
}

async function dbGetById(db: IDBDatabase, ids: Id[]): Promise<QueryResult> {
    //console.log(`[cache] Fetching ${ids.join(', ')}`);
    const tx = db.transaction('elements', 'readonly');
    const store = tx.objectStore('elements');

    const data = await Promise.all(
        ids.map(id => {
            const uid = unpack(id);
            return dbReq<OsmElement | undefined>(store.get([uid.type, uid.id]));
        }));

    const results: QueryResult = new Map();
    for (const eData of data) {
        if (!eData) { continue; }
        if (eData.type === 'relation') {
            const r = new Relation(pack(eData), eData);
            memCacheId.set(r.id, r);
            results.set(r.id, r);
        }
        else if (eData.type === 'way') {
            const w = new Way(pack(eData), eData);
            memCacheId.set(w.id, w);
            results.set(w.id, w);
        }
        else if (eData.type === 'node') {
            const n = new Node(pack(eData), eData);
            memCacheId.set(n.id, n);
            results.set(n.id, n);
        }
    }

    for (const id of ids) {
        if (!results.has(id)) {
            results.set(id, undefined);
        }
    }

    return results;
}

async function dbGetTransportByBounds(db: IDBDatabase, bounds: string): Promise<QueryResult> {
    const tx = db.transaction(['transport', 'elements'], 'readonly');
    const tStore = tx.objectStore('transport');

    let ids = [] as Id[];
    if (memCacheTransportBounds !== undefined && memCacheTransportBounds === bounds && memCacheTransport) {
        console.log(`[cache] Using mem-cached transport elements for ${bounds}`);
        ids = [...memCacheTransport];
    }
    else {
        console.log(`[cache] Fetching cached transport elements for ${bounds}`);
        const items = await dbReq(tStore.index('bounds').getAll(bounds)) as TransportDbItem[];
        ids = items.map(item => pack({ type: item.type, id: item.id }));
        console.log(`[cache] Found ${ids.length} transport elements in cache`);
    }

    return await dbGetById(db, ids);
}

/** Generate a promise that will eventually be resolved once the element is fetched and cached */
function getDeferred(id: Id): Promise<QueryElement> {
    if (deferredPromises.has(id)) {
        return deferredPromises.get(id)!;
    }

    const p = new Promise<QueryElement>((resolve) => {
        deferredCallbacks.set(id, resolve);
    });
    deferredPromises.set(id, p);
    return p;
}

async function requestAndCache(ids: Id[]): Promise<QueryResult> {
    if (ids.length === 0) {
        return new Map();
    }

    const results: QueryResult = new Map();

    const db = await dbInit();
    const dbEs = await dbGetById(db, ids);
    console.log(`[load] Found ${dbEs.size} elements in cache`);
    for (const e of dbEs.values()) {
        if (e) {
            results.set(e.id, e);
        }
    }

    const requestIds = ids.filter(id => !results.has(id));
    if (requestIds.length > 0) {
        const reqEs = await requestAsync(requestIds);
        await dbPutAll(db, reqEs); 
        console.log(`[load] Fetched ${reqEs.size} elements from server`);

        for (const e of reqEs.values()) {
            if (e) {
                results.set(e.id, e);
                memCacheId.set(e.id, e);
            }
        }
    }

    for (const id of ids) {
        if (!results.has(id)) {
            results.set(id, undefined);
        }
    }

    db.close();
    return results;
}

type GetOptions = {
    request: boolean,
    cache: boolean,
};

const DefaultOptions: GetOptions = {
    request: true,
    cache: true,
};

export async function getAsync(
    ids: Id[],
    opts?: Partial<GetOptions>,
): Promise<(Element | undefined)[]> {
    const { request, cache } = { ...DefaultOptions, ...opts };

    // unreverse and filter out waygroups
    const remainingIds = new Set<Id>(ids);
    const results = new Map<Id, Element | undefined>();
    console.log(`[load] ${remainingIds.size} elements requested`);

    // objects already loaded, return from memory cache
    const memCached = [...remainingIds.values()].filter(id => memCacheId.has(id));
    for (const id of memCached) {
        results.set(id, memCacheId.get(id)!);
        remainingIds.delete(id);
    }
    console.log('[load] After memcache,', remainingIds.size, 'elements remaining');
    if (remainingIds.size === 0) {
        return ids.map(id => results.get(id));
    }

    if (request && cache) {
        // request everything not in flight
        const toRequest = [...remainingIds.values()].filter(id => !reqPromises.has(id));
        console.log(`[load] Starting ${toRequest.length} cache+requests`);
        const p = requestAndCache(toRequest);
        for (const id of toRequest) {
            reqPromises.set(id,
                p.then(es => {
                    reqPromises.delete(id);
                    return es.get(id);
                }));
        }

        // wait for the pending requests and return them
        const pendingReqs = [...remainingIds.values()].map(id => reqPromises.get(id)!);
        const pendingEs = await Promise.all(pendingReqs);
        for (const pendingE of pendingEs) {
            if (pendingE && remainingIds.has(pendingE.id)) {
                results.set(pendingE.id, pendingE);
                remainingIds.delete(pendingE.id);
                deferredCallbacks.get(pendingE.id)?.(pendingE);
            }
        }
        console.log('[load] After cached/requests,', remainingIds.size, 'elements remaining');
    }
    else if (cache) {
        // fetch everything not in flight
        const toFetch = [...remainingIds.values()].filter(id => !cachePromises.has(id));
        console.log(`[load] Starting ${toFetch.length} cached`);

        const db = await dbInit();
        const p = dbGetById(db, toFetch);
        for (const id of toFetch) {
            cachePromises.set(id,
                p.then(es => {
                    cachePromises.delete(id);
                    return es.get(id);
                }));
        }

        const pendingFetches = [...remainingIds.values()].map(id => cachePromises.get(id)!);
        const pendingEs = await Promise.all(pendingFetches);
        for (const pendingE of pendingEs) {
            if (pendingE && remainingIds.has(pendingE.id)) {
                results.set(pendingE.id, pendingE);
                remainingIds.delete(pendingE.id);
                deferredCallbacks.get(pendingE.id)?.(pendingE);
            }
        }
        console.log('[load] After cached,', remainingIds.size, 'elements remaining');
    }
    if (remainingIds.size === 0) {
        return ids.map(id => results.get(id));
    }

    console.log(`[load] Deferring ${remainingIds.size} elements`);
    const deferred = [...remainingIds.values()].map(id => getDeferred(id));
    const deferredEs = await Promise.all(deferred);
    for (const e of deferredEs) {
        if (remainingIds.has(e.id)) {
            results.set(e.id, e);
            remainingIds.delete(e.id);
        }
    }

    return ids.map(id => results.get(id));
}

export function get<T extends Element, U extends OsmElement>(id: Id, t: ElementCtor<T, U>): T | undefined {
    const e = memCacheId.get(id);
    if (t && e instanceof t) {
        return e as T;
    } else {
        return undefined;
    }
}

export async function getByTransportTypeAsync<T extends QueryElement>(
    bounds: LatLngTuple[], 
    transportType: TransportType, 
    opts?: Partial<GetOptions>,
): Promise<T[]> {
    opts = { ...DefaultOptions, ...opts };

    const db = await dbInit();

    const boundsStr = bounds.flat().join(' ');

    let es = await dbGetTransportByBounds(db, boundsStr);
    console.log(`[cache] Found ${es.size} transport elements in cache`);
    if (opts.request && es.size === 0) {
        const ids = await requestTransport(boundsStr);
        console.log(`[load] Found ${ids.length} transport elements in request`);
        es = await requestAsync(ids);
        console.log(`[load] Fetched ${es.size} transport elements from server`);
        await dbPutAll(db, es, boundsStr);
    }

    db.close();
    console.log(`[load] ${es.size} transport elements`);

    return [...es.values()]
        .filter(e => {
            return e?.data.tags?.public_transport === transportType
                || e?.data.tags?.type === transportType;
        }) as T[];
}
