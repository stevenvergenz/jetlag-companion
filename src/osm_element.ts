import { OsmElement, OsmNode, OsmRelation, OsmWay, get } from "./overpass_api";
import { Id, pack, unpack, reverse, unreversed } from './id';

export abstract class Element {

    public readonly id: Id;

    protected readonly _data?: OsmElement;
    public abstract get data(): OsmElement;

    public parentIds = [] as Id[];
    protected getParents() {
        return this.parentIds
            .map(id => get(id))
            .filter(e => e !== undefined);
    }
    public abstract get parents(): Element[];

    public childIds = [] as Id[];
    protected getChildren() {
        return this.childIds
            .map(id => get(id))
            .filter(e => e !== undefined);
    }
    public abstract get children(): Element[];

    public get name(): string {
        return this._data?.tags?.['name'] 
            ?? this._data?.tags?.['description'] 
            ?? this._data?.tags?.['ref'] 
            ?? '<unspecified>';
    }

    public get complete(): boolean {
        return this.children.every(c => c?.complete);
    }

    public get completeIds(): Id[] {
        return [this.id, ...this.children.flatMap(c => c?.completeIds)];
    }

    public constructor(id: Id, data?: OsmElement) {
        this.id = id;
        this._data = data;
    }

    public addChildUnique(id: Id) {
        if (id && !this.childIds.includes(id)) {
            this.childIds.push(id);
        }
    }
}

abstract class GenericElement<P extends Element, C extends Element> extends Element {
    public get parents(): P[] {
        return this.getParents() as P[];
    }

    public get children(): C[] {
        return this.getChildren() as C[];
    }
}

export class Relation extends GenericElement<Element, WayGroup> {
    public readonly wayGroups = new Map<Id, WayGroup>();

    public constructor(id: Id, data: OsmRelation) {
        super(id, data);

        for (const w of this.data.members.filter(m => m.type === 'way')) {
            const memberId = pack({ type: w.type, id: w.ref });
            WayGroup.setInterest(memberId, this);
        }
    }

    public get data() {
        return this._data as OsmRelation;
    }

    public get children(): WayGroup[] {
        return this.childIds
            .map(id => this.wayGroups.get(id))
            .filter(wg => wg !== undefined);
    }
}

export class WayGroup extends GenericElement<Relation, Way> {
    private static lastIndices: { [id: Id]: number } = {};
    private static interests = new Map<Id, Relation[]>();
    private static knownIds = new Set<Id>();

    public static setInterest(wayId: Id, relation: Relation) {
        if (this.knownIds.has(wayId)) {
            this.fulfillInterest(get(wayId) as Way, relation);
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
        /** All roles for the fulfilled way */
        const roles = new Set(relation.data.members
            .filter(m => pack({ type: m.type, id: m.ref }) === way.id)
            .map(m => m.role));
        if (roles.size === 0) {
            return;
        }

        for (const role of roles) {
            /** The list of known way groups that successfully added the fulfilled way */
            const added = relation.children.filter(wg => wg.role === role && wg.add(way));

            // no existing way group will take it, add a new one
            if (added.length === 0) {
                const wg = new WayGroup(relation.id, role, way);
                relation.wayGroups.set(wg.id, wg);
                relation.addChildUnique(wg.id);
                continue;
            }

            // check if the new way bridged two existing way groups
            for (let i = 0; i < added.length - 1; i++) {
                /** The older of two way groups */
                const senior = added[i];
                let junior: WayGroup | undefined;
                if (unreversed(senior.childIds[0]) === way.id) {
                    // the newer way group connects to the beginning of the older
                    junior = added.slice(i+1)
                        .find(wg => [wg.startsWithNode, wg.endsWithNode].includes(senior.startsWithNode));
                }
                else {
                    /// the newer way group connects to the end of the older
                    junior = added.slice(i+1).
                        find(wg => [wg.startsWithNode, wg.endsWithNode].includes(senior.endsWithNode));
                }

                if (!junior) {
                    continue;
                }

                if (senior.endsWithNode === junior.startsWithNode) {
                    senior.childIds.push(...junior.childIds.slice(1));
                    senior.endsWithNode = junior.endsWithNode;
                }
                else if (junior.endsWithNode === senior.startsWithNode) {
                    senior.childIds.unshift(...junior.childIds.slice(0, -1));
                    senior.startsWithNode = junior.startsWithNode;
                }
                else if (junior.startsWithNode === senior.startsWithNode) {
                    senior.childIds.unshift(...junior.childIds.slice(1).reverse().map(w => reverse(w)));
                    senior.startsWithNode = junior.endsWithNode;
                }
                else if (junior.endsWithNode === senior.endsWithNode) {
                    senior.childIds.push(...junior.childIds.slice(0, -1).reverse().map(w => reverse(w)));
                    senior.endsWithNode = junior.startsWithNode;
                }

                relation.wayGroups.delete(junior.id);
                relation.childIds = relation.childIds.filter(id => id !== junior.id);
            }
        }
    }

    public readonly role: string;
    public startsWithNode: Id;
    public endsWithNode: Id;

    public get data(): never {
        throw new Error("WayGroups don't have data");
    }

    public constructor(relationId: Id, role: string, ...ways: Way[]) {
        const rid = unpack(relationId);
        const nextOffset = WayGroup.lastIndices[relationId] ?? 0;
        WayGroup.lastIndices[relationId] = nextOffset;
        super(pack({ type: 'wayGroup', id: rid.id, offset: nextOffset }), undefined);

        this.parentIds.push(relationId);
        this.role = role;
        this.startsWithNode = '';
        this.endsWithNode = '';

        for (const w of ways) {
            if (!this.add(w)) {
                throw new Error('Ways do not connect');
            }
        }
    }

    public add(way: Way): boolean {
        const firstNode = pack({ type: 'node', id: way.data.nodes[0] });
        const lastNode = pack({ type: 'node', id: way.data.nodes[way.data.nodes.length - 1] });
        if (this.childIds.length === 0) {
            this.childIds.push(way.id);
            this.startsWithNode = firstNode;
            this.endsWithNode = lastNode;
            way.parentIds.push(this.id);
        }
        else if (this.endsWithNode === firstNode) {
            this.childIds.push(way.id);
            this.endsWithNode = lastNode;
            way.parentIds.push(this.id);
        }
        else if (this.startsWithNode === lastNode) {
            this.childIds.unshift(way.id);
            this.startsWithNode = firstNode;
            way.parentIds.push(this.id);
        }
        else if (this.startsWithNode === firstNode) {
            this.childIds.unshift(reverse(way.id));
            this.startsWithNode = lastNode;
            way.parentIds.push(this.id);
        }
        else if (this.endsWithNode === lastNode) {
            this.childIds.push(reverse(way.id));
            this.endsWithNode = firstNode;
            way.parentIds.push(this.id);
        }
        else {
            return false;
        }

        return true;
    }
}

export class Way extends GenericElement<WayGroup, Node> {
    public constructor(id: Id, data: OsmWay) {
        super(id, data);

        for (const n of this.data.nodes) {
            const nodeId = pack({ type: 'node', id: n });
            const node = get(nodeId);
            if (node) {
                node.parentIds.push(this.id);
            }
            else {
                Node.parentIds.set(nodeId, [...(Node.parentIds.get(nodeId) ?? []), this.id]);
            }
            
            this.addChildUnique(nodeId);
        }
    }

    public get data() { return this._data as OsmWay; }
}

export class Node extends GenericElement<Way, Element> {
    public static parentIds = new Map<Id, Id[]>();

    public constructor(id: Id, data: OsmNode) {
        super(id, data);
        this.parentIds = Node.parentIds.get(id) ?? [];
        Node.parentIds.delete(id);
    }

    public get data() {
        return this._data as OsmNode;
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
