import { OsmElement, OsmNode, OsmRelation, OsmWay, get } from "./overpass_api";
import { Id, pack, unpack, reverse, unreversed } from './id';

export abstract class Element {

    public readonly id: Id;

    protected readonly _data?: OsmElement;
    public abstract get data(): OsmElement;

    public parentIds = new Set<Id>();
    protected getParents() {
        return [...this.parentIds]
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
    private static nextOffsets: { [id: Id]: number } = {};
    private static interests = new Map<Id, Set<Id>>();
    private static knownIds = new Set<Id>();

    public static setInterest(wayId: Id, relation: Relation) {
        if (this.knownIds.has(wayId)) {
            this.fulfillInterest(get(wayId) as Way, relation);
        }
        else if (this.interests.has(wayId)) {
            this.interests.get(wayId)!.add(relation.id);
        }
        else {
            this.interests.set(wayId, new Set([relation.id]));
        }
    }

    public static fulfillInterests(way: Way) {
        this.knownIds.add(way.id);
        for (const rid of this.interests.get(way.id) ?? []) {
            const r = get(rid) as Relation;
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

        const wayEnds = [way.childIds[0], way.childIds[way.childIds.length - 1]];

        for (const role of roles) {
            /** The list of known way groups that successfully added the fulfilled way */
            const added = relation.children.filter(wg => wg.role === role && wg.add(way));

            // no existing way group will take it, add a new one
            if (added.length === 0) {
                const wg = new WayGroup(relation.id, role, way);
                relation.wayGroups.set(wg.id, wg);
                relation.addChildUnique(wg.id);
                way.parentIds.add(wg.id);
                continue;
            }

            // check if the new way bridged two existing way groups
            for (let i = 0; i < added.length - 1; i++) {
                /** The older of two way groups */
                const senior = added[i];
                const seniorEndWays = [
                    unreversed(senior.childIds[0]), 
                    unreversed(senior.childIds[senior.childIds.length - 1]),
                ];
                const junior = added.slice(i+1).find(wg => {
                    return seniorEndWays.includes(unreversed(wg.childIds[0]))
                        || seniorEndWays.includes(unreversed(wg.childIds[wg.childIds.length - 1]));
                });

                if (!junior) {
                    continue;
                }

                const seniorStart = wayEnds.indexOf(senior.startsWithNode);
                const seniorEnd = wayEnds.indexOf(senior.endsWithNode);
                const juniorStart = wayEnds.indexOf(junior.startsWithNode);
                const juniorEnd = wayEnds.indexOf(junior.endsWithNode);

                // append forward
                if (seniorEnd >= 0 && juniorStart >= 0 && seniorEnd !== juniorStart) {
                    senior.childIds.push(...junior.childIds.slice(1));
                    senior.endsWithNode = junior.endsWithNode;
                }
                // prepend forward
                else if (seniorStart >= 0 && juniorEnd >= 0 && seniorStart !== juniorEnd) {
                    senior.childIds.unshift(...junior.childIds.slice(0, -1));
                    senior.startsWithNode = junior.startsWithNode;
                }
                // append reverse
                else if (seniorEnd >= 0 && juniorEnd >= 0 && seniorEnd !== juniorEnd) {
                    senior.childIds.push(...junior.childIds.reverse().map(w => reverse(w)).slice(1));
                    senior.endsWithNode = junior.startsWithNode;
                }
                // prepend reverse
                else if (seniorStart >= 0 && juniorStart >= 0 && seniorStart !== juniorStart) {
                    senior.childIds.unshift(...junior.childIds.reverse().map(w => reverse(w)).slice(0, -1));
                    senior.startsWithNode = junior.endsWithNode;
                }
                else {
                    console.error('How did we get here?');
                    continue;
                }

                relation.wayGroups.delete(junior.id);
                relation.childIds = relation.childIds.filter(id => id !== junior.id);
                
                way.parentIds.delete(junior.id);
                if (way.id === 'w:909645217') {
                    console.log(`Deleting way ${way.id} from way group ${junior.id}:`, way.parentIds);
                }
            }
        }
    }

    public readonly role: string;
    public startsWithNode: Id;
    public endsWithNode: Id;

    public get data(): never {
        throw new Error("WayGroups don't have data");
    }

    public get name(): string {
        return `${this.children[0].name}, ${this.role}`;
    }

    public constructor(relationId: Id, role: string, ...ways: Way[]) {
        const offset = WayGroup.nextOffsets[relationId] ?? 0;
        WayGroup.nextOffsets[relationId] = offset + 1;
        const rid = unpack(relationId);
        super(pack({ type: 'wayGroup', id: rid.id, offset }), undefined);

        this.parentIds.add(relationId);
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
        const firstNode = way.childIds[0];
        const lastNode = way.childIds[way.childIds.length - 1];
        if (this.childIds.length === 0) {
            this.childIds.push(way.id);
            this.startsWithNode = firstNode;
            this.endsWithNode = lastNode;
            way.parentIds.add(this.id);
        }
        else if (this.endsWithNode === firstNode) {
            this.childIds.push(way.id);
            this.endsWithNode = lastNode;
            way.parentIds.add(this.id);
        }
        else if (this.startsWithNode === lastNode) {
            this.childIds.unshift(way.id);
            this.startsWithNode = firstNode;
            way.parentIds.add(this.id);
        }
        else if (this.startsWithNode === firstNode) {
            this.childIds.unshift(reverse(way.id));
            this.startsWithNode = lastNode;
            way.parentIds.add(this.id);
        }
        else if (this.endsWithNode === lastNode) {
            this.childIds.push(reverse(way.id));
            this.endsWithNode = firstNode;
            way.parentIds.add(this.id);
        }
        else {
            return false;
        }
        
        if (way.id === 'w:909645217') {
            console.log(`Added way ${way.id} to way group ${this.id}:`, way.parentIds);
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
                node.parentIds.add(this.id);
            }
            else if (Node.parentIds.has(nodeId)){
                const parents = Node.parentIds.get(nodeId)!;
                parents.add(this.id);
            }
            else {
                Node.parentIds.set(nodeId, new Set([id]));
            }
            
            this.addChildUnique(nodeId);
        }

        WayGroup.fulfillInterests(this);
    }

    public get data() { return this._data as OsmWay; }
}

export class Node extends GenericElement<Way, Element> {
    public static parentIds = new Map<Id, Set<Id>>();

    public constructor(id: Id, data: OsmNode) {
        super(id, data);
        this.parentIds = Node.parentIds.get(id) ?? new Set();
        Node.parentIds.delete(id);
    }

    public get data() {
        return this._data as OsmNode;
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
