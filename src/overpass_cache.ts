import { LatLngTuple } from 'leaflet';
import { Id, pack, unpack, unreversed } from './id';
import { Element, Node, Relation, Way, WayGroup } from './element';
import { OsmElement, OsmElementType, requestAsync, requestTransport } from './overpass_api';

type CleanLatLng = [number, number];

type TransportDbItem = {
    bounds: CleanLatLng[],
    transportType: string,
    type: OsmElementType,
    id: number,
};

const memCacheId = new Map<Id, Element>();
const memCacheTransport = new Map<string, Id[]>();
let memCacheTransportBounds = [] as LatLngTuple[];
const getPromises = new Map<Id, Promise<Element[]>>();
const getCallbacks = new Map<Id, (e: Element[]) => void>();

function dbReq<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

let _db: IDBDatabase | null = null;
async function dbInit(): Promise<IDBDatabase> {
    if (!_db) {
        const req = indexedDB.open('overpass-cache', 1);

        req.addEventListener('upgradeneeded', () => {
            req.result.createObjectStore('elements', { keyPath: ['type', 'id'] });
            req.result.createObjectStore('transport', { keyPath: ['bounds', 'transportType'] });
        });

        _db = await dbReq(req);
    }
    return _db!;
}

async function dbPut(es: Element[], bounds?: LatLngTuple[]): Promise<void> {
    const db = await dbInit();
    const tx = db.transaction(['elements', 'transport'], 'readwrite');
    const eStore = tx.objectStore('elements');
    const tStore = tx.objectStore('transport');

    const cleanBounds = bounds?.map(b => b.slice(0, 2) as CleanLatLng) ;

    await Promise.all(es
        .map(async (e) => {
            if (!(e instanceof WayGroup)) {
                memCacheId.set(e.id, e);
                await dbReq(eStore.put(e.data));
            }

            if (cleanBounds && e.data.tags && (
                e.data.tags.public_transport 
                || ['route', 'route_master'].includes(e.data.tags.type)
            )) {
                if (memCacheTransportBounds.length !== cleanBounds.length
                    || !memCacheTransportBounds.every((b, i) => b === cleanBounds[i])
                ) {
                    memCacheTransportBounds = cleanBounds;
                    memCacheTransport.clear();
                }

                memCacheTransport.set(
                    e.data.tags.public_transport!,
                    [...(memCacheTransport.get(e.data.tags.public_transport!) ?? []), e.id]);
                    
                await dbReq(tStore.put({
                    bounds: cleanBounds, 
                    transportType: e.data.tags?.public_transport ?? e.data.tags.type, 
                    type: e.data.type,
                    id: e.data.id,
                } satisfies TransportDbItem));
            }

            getCallbacks.get(e.id)?.([e]);
            getCallbacks.delete(e.id);
        })
    );
}

async function dbGetById(ids: Id[], tx?: IDBTransaction): Promise<Element[]> {
    if (!tx) {
        const db = await dbInit();
        tx = db.transaction('elements', 'readonly');
    }
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

async function dbGetByTransportType(bounds: LatLngTuple[], transportType: string): Promise<Element[]> {
    const db = await dbInit();
    const tx = db.transaction(['transport', 'elements'], 'readonly');
    const tStore = tx.objectStore('transport');

    bounds = bounds?.map(b => [b[0], b[1]]);

    let ids = [] as Id[];
    if (memCacheTransportBounds.length === bounds.length
        && memCacheTransportBounds.every((b, i) => b === bounds[i])
        && memCacheTransport.has(transportType)
    ) {
        ids = memCacheTransport.get(transportType)!;
    }
    else {
        const items = await dbReq(tStore.getAll([bounds, transportType])) as TransportDbItem[];
        ids = items.map(item => pack({ type: item.type, id: item.id }));
    }

    return await dbGetById(ids, tx);
}

function getDeferred(id: Id): Promise<Element[]> {
    return new Promise((resolve) => {
        getCallbacks.set(id, resolve);
    });
}

async function getInternalAsync(ids: Id[], { request }: { request: boolean }): Promise<Element[]> {
    const dbEs = await dbGetById(ids);
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
        await dbPut(reqEs);
    }
    else {
        for (const id of requestIds) {
            getPromises.set(id, getDeferred(id));
        }
        reqEs = (await Promise.all(requestIds.map(id => getPromises.get(id)!))).flat();
    }

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
        ids.filter(id => getPromises.has(id)).map(id => getPromises.get(id)!)
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

export async function getByTransportTypeAsync(
    bounds: LatLngTuple[], 
    transportType: string, 
    { request } = { request: false },
): Promise<Element[]> {
    const localEs = await dbGetByTransportType(bounds, transportType);
    if (!request || localEs.length > 0) {
        return localEs;
    }

    const reqEs = await requestTransport(bounds);
    await dbPut(reqEs, bounds);
    return reqEs;
}