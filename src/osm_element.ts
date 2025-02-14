import { OsmElement, OsmNode, OsmRelation, OsmWay, get } from "./overpass_api";

export abstract class Element {
    static parentIds = new Map<number, number[]>();

    public abstract get parents(): Element[];

    public abstract get children(): Element[];

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

    public get complete(): boolean {
        return this.children.every(c => c?.complete);
    }

    public get completeIds(): number[] {
        return [this.id, ...this.children.flatMap(c => c?.completeIds)];
    }
}

export class Relation extends Element {
    public constructor(data: OsmRelation) {
        super(data);

        for (const w of this.data.members.filter(m => m.type === 'way')) {
            Element.parentIds.set(w.ref, [...(Element.parentIds.get(w.ref) ?? []), this.id]);
        }
    }

    public get data() { return this._data as OsmRelation; }

    public get parents() {
        return [];
    }

    public get children(): Way[] {
        return this.data.members
            .map((m) => m.ref)
            .filter((id, i, arr) => !arr.slice(0, i).includes(id))
            .map((id) => get(id) as Way);
    }

    public get wayGroups(): Way[] {
        return this.children
            .filter((w) => w.previous === undefined);
    }
}

export class Way extends Element {
    /** Maps node IDs to a way that has that node as its first */
    static firstNodes = new Map<number, Way>();
    /** Maps node IDs to a way that has that node as its last */
    static lastNodes = new Map<number, Way>();

    public previous?: Way;
    public next?: Way;

    public constructor(data: OsmWay) {
        super(data);

        for (const n of this.data.nodes) {
            Element.parentIds.set(n, [...(Element.parentIds.get(n) ?? []), this.id]);
        }

        Way.firstNodes.set(this.children[0].id, this);
        Way.lastNodes.set(this.children[this.children.length - 1].id, this);

        let other = Way.lastNodes.get(this.children[0].id);
        if (other) {
            other.next = this;
            this.previous = other;
        }

        other = Way.firstNodes.get(this.children[this.children.length - 1].id);
        if (other) {
            other.previous = this;
            this.next = other;
        }
    }

    public get data() { return this._data as OsmWay; }

    public get parents(): Relation[] {
        return Element.parentIds.get(this.id)?.map(pid => get(pid) as Relation) ?? [];
    }

    public get children(): Node[] {
        return this.data.nodes
            .map(n => get(n) as Node);
    }

    public get first(): Way {
        let f = this as Way;
        while (f.previous) {
            f = f.previous;
        }
        return f;
    }

    public get following(): Way[] {
        let f: Way | undefined = this.next;
        const following = [];
        while (f) {
            following.push(f);
            f = f.next;
        }
        return following;
    }
}

export class Node extends Element {
    public constructor(data: OsmNode) {
        super(data);
    }

    public get data() { return this._data as OsmNode; }

    public get parents(): Way[] {
        return Element.parentIds.get(this.id)?.map(pid => get(pid) as Way) ?? [];
    }

    public get children() {
        return [];
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
