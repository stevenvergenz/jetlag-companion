import EventEmitter from "events";
import { OsmElement, OsmNode, OsmRelation, OsmWay, getAsync, get } from "./overpass_api";

export class Element extends EventEmitter {
    static parentIds = new Map<number, number[]>();

    protected _data: OsmElement;
    private _hovering: boolean;
    private _inheritHovering: number;

    public constructor(data: OsmElement) {
        super();
        this._data = data;
        this._hovering = false;
        this._inheritHovering = 0;
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

    public get hovering() { return this._inheritHovering > 0 || this._hovering; }
    public set hovering(val: boolean) {
        const wasHovering = this.hovering;
        this._hovering = val;
        if (this.hovering !== wasHovering) {
            this.emit('hovering', this.hovering);
        }
    }

    public registerInheritedHover() {
        for (const pid of Element.parentIds.get(this.id) ?? []) {
            const p = get(pid)
            p.addListener('hovering', pHover => {
                const wasHovering = this.hovering;
                this._inheritHovering += pHover ? 1 : -1;
                if (this.hovering !== wasHovering) {
                    this.emit('hovering', this.hovering);
                }
            });
        }
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

    public get ways(): Way[] {
        return this.data.members
            .filter(m => m.type === 'way')
            .map(m => get(m.ref));
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

    public previous?: Way;
    public next?: Way;

    public constructor(data: OsmWay) {
        super(data);

        for (const n of this.data.nodes) {
            Element.parentIds.set(n, [...(Element.parentIds.get(n) ?? []), this.id]);
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
            .map(n => get(n));
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

    public get parents(): Relation[] {
        return Element.parentIds.get(this.id)?.map(pid => get(pid)) ?? [];
    }
}

export class Node extends Element {
    public constructor(data: OsmNode) {
        super(data);
    }

    public get data() { return this._data as OsmNode; }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }

    public get parents(): Way[] {
        return Element.parentIds.get(this.id)?.map(pid => get(pid)) ?? [];
    }
}
