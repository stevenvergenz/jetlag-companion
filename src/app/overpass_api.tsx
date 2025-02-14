import { Boundary } from "./boundaries";

const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const LOWER_US = '24.41,-125.51,49.61,-66.09';
const cache = new Map<number, Element>();

type OsmQueryResult = {
    version: string,
    generator: string,
    elements: OsmElement[],
};

type OsmElementType = 'relation' | 'way' | 'node';
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

type OsmElement = OsmRelation | OsmWay | OsmNode;

export class Element {
    protected _data: OsmElement;

    public constructor(data: OsmElement) {
        this._data = data;
    }

    public get id(): number {
        return this._data.id;
    }

    public get name(): string {
        return this._data.tags?.['name'] 
            ?? this._data.tags?.['description'] 
            ?? this._data.tags?.['ref'] 
            ?? '<unspecified>';
    }
}

export class Relation extends Element {
    public constructor(data: OsmRelation) {
        super(data);

        for (const w of this.ways) {
            if (!w) { continue; }
            w.parents.push(this);
        }
    }

    public get data() { return this._data as OsmRelation; }

    public get ways(): Way[] {
        return this.data.members
            .filter(m => m.type === 'way')
            .map(m => cache.get(m.ref) as Way);
    }

    public get wayGroups(): Way[] {
        return this.ways
            .filter(w => w.previous === undefined);
    }
}

export class Way extends Element {
    /** Maps node IDs to a way that has that node as its first */
    static firstNodes = new Map<number, Way>();
    /** Maps node IDs to a way that has that node as its last */
    static lastNodes = new Map<number, Way>();

    public parents: Relation[];

    public previous?: Way;
    public next?: Way;

    public constructor(data: OsmWay, ...parents: Relation[]) {
        super(data);
        this.parents = parents;

        for (const n of this.nodes) {
            if (!n) { continue; }
            n.parents.push(this);
        }

        Way.firstNodes.set(this.nodes[0].id, this);
        Way.lastNodes.set(this.nodes[this.nodes.length - 1].id, this);

        let other: Way | undefined;
        if (other = Way.lastNodes.get(this.nodes[0].id)) {
            other.next = this;
            this.previous = other;
        }

        if (other = Way.firstNodes.get(this.nodes[this.nodes.length - 1].id)) {
            other.previous = this;
            this.next = other;
        }
    }

    public get data() { return this._data as OsmWay; }

    public get nodes(): Node[] {
        return this.data.nodes
            .map(n => cache.get(n) as Node);
    }

    public get first(): Way {
        let f: Way = this;
        while (f.previous) {
            f = f.previous;
        }
        return f;
    }

    public get following(): Way[] {
        let f: Way | undefined = this.next;
        let following = [];
        while (f) {
            following.push(f);
            f = f.next;
        }
        return following;
    }
}

export class Node extends Element {
    public parents: Way[];
    public constructor(data: OsmNode, ...parents: Way[]) {
        super(data);
        this.parents = parents;
    }

    public get data() { return this._data as OsmNode; }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}

async function req(type: 'relation', id: number): Promise<Relation>;
async function req(type: 'way', id: number): Promise<Way>;
async function req(type: 'node', id: number): Promise<Node>;
async function req(type: OsmElementType, id: number): Promise<Element> {
    if (!cache.has(id)) {
        const res = await fetch(ENDPOINT, {
            method: 'POST',
            body: `[out:json]; ${type}(${id}); >>; out;`,
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
        return cache.get(id) as Element;
    }
}

export function getRelation(id: number): Promise<Relation> {
    return req('relation', id);
}

export function getWay(id: number): Promise<Way> {
    return req('way', id);
}

export async function getNode(id: number): Promise<Node> {
    return req('node', id);
}

/*
export async function get_road_paths(b: Boundary): Promise<OsmNode[][]> {
    const waysQuery = `
        [out:json];
        relation
            (${b.id});
        way(r);
        out;`;
    const waysReq = await req<OsmWay>(waysQuery);

    let ways = waysReq.elements.reduce((map, w) => {
        map.set(w.id, w.nodes);
        return map;
    }, new Map<number, number[]>());
    const ends = waysReq.elements.reduce((map, w) => {
        map.set(w.nodes[w.nodes.length - 1], w.id);
        return map;
    }, new Map<number, number>());

    // merge all the ways that share start/end nodes
    let unstable = true;
    while (unstable) {
        unstable = false;
        for (const wayId of ways.keys()) {
            let nodeIds = ways.get(wayId) as number[];
            const preceding = ends.get(nodeIds[0]);
            if (preceding) {
                let pNodes = ways.get(preceding) as number[];
                ends.delete(pNodes[pNodes.length - 1]);
                pNodes.push(...nodeIds.slice(1));
                ways.set(preceding, pNodes);
                ends.set(pNodes[pNodes.length - 1], preceding);
                ways.delete(wayId);
                unstable = true;
            }
        }
    }

    const nodeIds = [...ways.values()].flat();
    const nodesQuery = `
        [out:json];
        node(id:${nodeIds.join(',')});
        out;`
    const nodes = await req<OsmNode>(nodesQuery);
    const nodeLookup: Map<number, OsmNode> = nodes.elements.reduce((map, n) => {
        map.set(n.id, n);
        return map;
    }, new Map());

    console.log('ways', ways);
    return [...ways.values()].map(way => way.map(id => nodeLookup.get(id) as OsmNode));
}
*/