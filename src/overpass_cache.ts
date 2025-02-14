import { Id, pack, unpack, unreversed } from './id';
import { Element, Node, Relation, Way, WayGroup } from './element';
import { OsmElement, requestAsync } from './overpass_api';

const memCacheId = new Map<Id, Element>();

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
            const os = req.result.createObjectStore('elements');
            os.createIndex('id', ['type', 'id'], { unique: true });
            os.createIndex('transport_type', 'tags.public_transport', { unique: false });
        });

        _db = await dbReq(req);
    }
    return _db!;
}

async function dbPut(es: Element[]): Promise<void> {
    const db = await dbInit();
    const tx = db.transaction('elements', 'readwrite');
    const store = tx.objectStore('elements');

    await Promise.all(es
        .map(async (e) => {
            if (!(e instanceof WayGroup)) {
                memCacheId.set(e.id, e);
                await dbReq(store.put(e.data));
            }
        })
    );
}

async function dbGetById(ids: Id[]): Promise<Element[]> {
    const db = await dbInit();
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

async function dbGetByTransportType(transportType: string): Promise<Element[]> {
    const db = await dbInit();
    const tx = db.transaction('elements', 'readonly');
    const store = tx.objectStore('elements').index('transport_type');

    const es = await dbReq(store.getAll(transportType));
    for (const e of es) {
        const id = pack(e);
        if (memCacheId.has(id)) {
            continue;
        }
        else if (e.type === 'node') {
            const n = new Node(id, e);
            memCacheId.set(n.id, n);
        }
        else if (e.type === 'way') {
            const w = new Way(id, e);
            memCacheId.set(w.id, w);
        }
        else if (e.type === 'relation') {
            const r = new Relation(id, e);
            memCacheId.set(r.id, r);
        }
        else {
            throw new Error('Unknown element type');
        }
    }

    return [...memCacheId.values()].filter(e => e.data.tags?.public_transport === transportType);
}

const getPromises = new Map<Id, Promise<Element[]>>();
const getCallbacks = new Map<Id, (e: Element[]) => void>();

export function getAsync(ids: Id[], request = false): Promise<Element[]> {
    ids = ids.map(unreversed);
    const lookupIds = ids.filter(id => !getPromises.has(id) && unpack(id).type !== 'wayGroup');

    if (lookupIds.length > 0) {
        const p = dbGetById(lookupIds)
            .then(es => {
                const remaining = ids.filter(id => es.find(e => e.id === id) === undefined);

            });
    }

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
        return (get(parentId) as Relation | undefined)?.wayGroups?.get(id);
    }
    else {
        return cache.get(unreversed(id));
    }
}
