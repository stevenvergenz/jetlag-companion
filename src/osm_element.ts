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
    public wayGroups: WayGroup[] = [];

    public constructor(data: OsmRelation) {
        super(data);

        for (const w of this.data.members.filter(m => m.type === 'way')) {
            Element.parentIds.set(w.ref, [...(Element.parentIds.get(w.ref) ?? []), this.id]);
            WayGroup.setInterest(w.ref, this);
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
            .map((id) => get('way', id)!)
            .filter((w) => w !== undefined);
    }
}

export class WayGroup {
    private static interests = new Map<number, Relation[]>();
    private static knownIds = new Set<number>();

    public static setInterest(wayId: number, relation: Relation) {
        if (this.knownIds.has(wayId)) {
            this.fulfillInterest(get('way', wayId)!, relation);
        }
        else {
            this.interests.set(wayId, [...(this.interests.get(wayId) ?? []), relation]);
        }
    }

    public static fulfillInterests(way: Way) {
        for (const r of this.interests.get(way.id) ?? []) {
            this.fulfillInterest(way, r);
        }
        this.interests.delete(way.id);
    }

    private static fulfillInterest(way: Way, relation: Relation) {
        const thisMembers = relation.data.members.filter(m => m.type === 'way' && m.ref === way.id);
        if (thisMembers.length === 0) {
            return;
        }

        for (const thisMember of thisMembers) {
            const added = relation.wayGroups.filter(wg => wg.role === thisMember.role && wg.add(way));
            if (added.length === 0) {
                relation.wayGroups.push(new WayGroup(relation.wayGroups.length, thisMember.role, way));
                continue;
            }

            for (let i = 0; i < added.length - 1; i++) {
                const senior = added[i];
                let junior: WayGroup | undefined;
                if (Math.abs(senior.ways[0]) === way.id) {
                    junior = added.slice(i+1)
                        .find(wg => [wg.startsWithNode, wg.endsWithNode].includes(senior.startsWithNode));
                }
                else {
                    junior = added.slice(i+1).
                        find(wg => [wg.startsWithNode, wg.endsWithNode].includes(senior.endsWithNode));
                }

                if (!junior) {
                    continue;
                }

                const juniorIndex = relation.wayGroups.indexOf(junior);

                if (senior.endsWithNode === junior.startsWithNode) {
                    senior.ways.push(...junior.ways.slice(1));
                    senior.endsWithNode = junior.endsWithNode;
                }
                else if (junior.endsWithNode === senior.startsWithNode) {
                    senior.ways.unshift(...junior.ways.slice(0, -1));
                    senior.startsWithNode = junior.startsWithNode;
                }
                else if (junior.startsWithNode === senior.startsWithNode) {
                    senior.ways.unshift(...junior.ways.slice(1).reverse().map(w => -w));
                    senior.startsWithNode = junior.endsWithNode;
                }
                else if (junior.endsWithNode === senior.endsWithNode) {
                    senior.ways.push(...junior.ways.slice(0, -1).reverse().map(w => -w));
                    senior.endsWithNode = junior.startsWithNode;
                }

                relation.wayGroups.splice(juniorIndex, 1);
                relation.wayGroups.slice(juniorIndex).forEach((wg, i) => wg.id = juniorIndex + i);
            }
        }
    }

    public id: number;
    public readonly role: string;
    public readonly ways: number[];
    public startsWithNode: number;
    public endsWithNode: number;

    public constructor(id: number, role: string, ...ways: Way[]) {
        this.id = id;
        this.role = role;
        this.ways = [];
        this.startsWithNode = NaN;
        this.endsWithNode = NaN;

        for (const w of ways) {
            if (!this.add(w)) {
                throw new Error('Ways do not connect');
            }
        }
    }

    public add(way: Way): boolean {
        if (this.ways.length === 0) {
            this.ways.push(way.id);
            this.startsWithNode = way.data.nodes[0];
            this.endsWithNode = way.data.nodes[way.data.nodes.length - 1];
        }
        else if (this.endsWithNode === way.data.nodes[0]) {
            this.ways.push(way.id);
            this.endsWithNode = way.data.nodes[way.data.nodes.length - 1];
        }
        else if (this.startsWithNode === way.data.nodes[way.data.nodes.length - 1]) {
            this.ways.unshift(way.id);
            this.startsWithNode = way.data.nodes[0];
        }
        else if (this.startsWithNode === way.data.nodes[0]) {
            this.ways.unshift(-way.id);
            this.startsWithNode = way.data.nodes[way.data.nodes.length - 1];
        }
        else if (this.endsWithNode === way.data.nodes[way.data.nodes.length - 1]) {
            this.ways.push(-way.id);
            this.endsWithNode = way.data.nodes[0];
        }
        else {
            return false;
        }

        return true;
    }
}

export class Way extends Element {
    public constructor(data: OsmWay) {
        super(data);

        for (const n of this.data.nodes) {
            Element.parentIds.set(n, [...(Element.parentIds.get(n) ?? []), this.id]);
        }
    }

    public get data() { return this._data as OsmWay; }

    public get parents(): Relation[] {
        return Element.parentIds.get(this.id)?.map(pid => get('relation', pid)!) ?? [];
    }

    public get children(): Node[] {
        return this.data.nodes
            .map(n => get('node', n)!)
            .filter(n => n !== undefined);
    }
}

export class Node extends Element {
    public constructor(data: OsmNode) {
        super(data);
    }

    public get data() { return this._data as OsmNode; }

    public get parents(): Way[] {
        return Element.parentIds.get(this.id)!.map(pid => get('way', pid)!) ?? [];
    }

    public get children() {
        return [];
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
