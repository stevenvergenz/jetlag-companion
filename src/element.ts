import { OsmElement, OsmNode, OsmRelation, OsmWay, OsmWayGroup } from "./overpass_api";
import { Id, pack, packFrom, unpack, reverse, unreversed } from './id';
import { get } from './overpass_cache';

export class HierarchyHelper {
    private static interests = new Map<Id, Set<Id>>();
    private static knownIds = new Set<Id>();

    public static reset() {
        this.interests = new Map();
        this.knownIds = new Set();
    }

    public static setInterest(childId: Id, parent: Element) {
        parent.addChildUnique(childId);

        if (this.knownIds.has(childId)) {
            this.fulfillInterest(get(childId)!, parent);
        }
        else if (this.interests.has(childId)) {
            this.interests.get(childId)!.add(parent.id);
        }
        else {
            this.interests.set(childId, new Set([parent.id]));
        }
    }

    public static fulfillInterests(child: Element) {
        this.knownIds.add(child.id);
        for (const rid of this.interests.get(child.id) ?? []) {
            const r = get(rid)!;
            this.fulfillInterest(child, r);
        }
        this.interests.delete(child.id);
    }

    private static fulfillInterest(child: Element, parent: Element) {
        child.parentIds.add(parent.id);
    }

    public static fulfillInterestRelationWay(child: Way, parent: Relation) {
        /** All roles for the fulfilled way */
        const roles = new Set(parent.data.members
            .filter(m => pack({ type: m.type, id: m.ref }) === child.id)
            .map(m => m.role));
        if (roles.size === 0) {
            return;
        }

        const wayEnds = [child.childIds[0], child.childIds[child.childIds.length - 1]];

        for (const role of roles) {
            /** The list of known way groups that successfully added the fulfilled way */
            const added = [...parent.wayGroups!.values()]
                .filter(e => e.role === role && e.add(child));

            // no existing way group will take it, add a new one
            if (added.length === 0) {
                const wg = new WayGroup(parent.id, role, child);
                parent.wayGroups!.set(wg.id, wg);
                parent.addChildUnique(wg.id);
                child.parentIds.add(wg.id);
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

                parent.wayGroups!.delete(junior.id);
                parent.childIds = parent.childIds.filter(id => id !== junior.id);
                
                for (const way of junior.children) {
                    way.parentIds.delete(junior.id);
                    way.parentIds.add(senior.id);
                }
            }
        }
    }
}

export abstract class Element {
    public readonly id: Id;

    protected readonly _data: OsmElement;
    public get data(): OsmElement {
        return this._data;
    }

    public parentIds = new Set<Id>();
    public get parents(): Element[] {
        return [...this.parentIds]
            .map(id => get(id))
            .filter(e => e !== undefined);
    }

    public childIds = [] as Id[];
    public get children(): Element[] {
        return this.childIds
            .map(id => get(id))
            .filter(e => e !== undefined);
    }

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

    public constructor(id: Id, data: OsmElement) {
        this.id = id;
        this._data = data;

        if (data.type === 'relation') {
            for (const id of data.members.map(m => packFrom(m))) {
                HierarchyHelper.setInterest(id, this);
            }
        }
        if (data.type === 'way') {
            for (const id of data.nodes.map(n => pack({ type: 'node', id: n }))) {
                HierarchyHelper.setInterest(id, this);
            }
        }

        HierarchyHelper.fulfillInterests(this);
    }

    public addChildUnique(id: Id) {
        if (id && !this.childIds.includes(id)) {
            this.childIds.push(id);
        }
    }
}

export class Relation extends Element {
    public wayGroups?: Map<Id, WayGroup>;

    public constructor(id: Id, data: OsmRelation) {
        super(id, data);
    }

    public get data() {
        return this._data as OsmRelation;
    }

    public calcWayGroups() {
        if (this.wayGroups) {
            return;
        }

        this.wayGroups = new Map();
        for (const w of this.children.filter(e => e instanceof Way)) {
            HierarchyHelper.fulfillInterestRelationWay(w, this);
        }
    }
}

export class WayGroup extends Element {
    private static nextOffsets: { [id: Id]: number } = {};

    public readonly role: string;
    public startsWithNode: Id;
    public endsWithNode: Id;

    public get name(): string {
        return `${this.children[0].name}, ${this.role}`;
    }

    public get data(): OsmWayGroup {
        return this._data as OsmWayGroup;
    }

    public constructor(relationId: Id, role: string, ...ways: Way[]) {
        const offset = WayGroup.nextOffsets[relationId] ?? 0;
        WayGroup.nextOffsets[relationId] = offset + 1;
        const rid = unpack(relationId);
        const wgId = pack({ type: 'wayGroup', id: rid.id, offset });
        super(wgId, {
            type: 'wayGroup',
            id: rid.id,
            index: offset,
        });

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
        
        return true;
    }
}

export class Way extends Element {
    public constructor(id: Id, data: OsmWay) {
        super(id, data);

        for (const n of this.data.nodes) {
            const nodeId = pack({ type: 'node', id: n });
            HierarchyHelper.setInterest(nodeId, this);
        }
    }

    public get data() { return this._data as OsmWay; }

    public get children(): Node[] {
        return this.childIds
            .map(id => get(id))
            .filter(e => e !== undefined) as Node[];
    }
}

export class Node extends Element {
    public constructor(id: Id, data: OsmNode) {
        super(id, data);
    }

    public get data() {
        return this._data as OsmNode;
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
