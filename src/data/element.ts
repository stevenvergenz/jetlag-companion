import { OsmElement, OsmWayGroup } from "./overpass_api";
import { Id, pack, packFrom, unpack, reverse } from './id';
import { get, getAsync } from '../overpass_cache';
import HierarchyHelper from "./hierarchy_helper";
import Way from './way';
import Relation from './relation';

export default abstract class Element {
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
            ?? '<unnamed>';
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
        else if (data.type === 'way') {
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

class WayGroup extends Element {
    private static nextOffsets: { [id: Id]: number } = {};

    public static fromWays(relationId: Id, role: string, ...ways: Way[]) {
        const offset = WayGroup.nextOffsets[relationId] ?? 0;
        WayGroup.nextOffsets[relationId] = offset + 1;
        const rid = unpack(relationId);
        const wgId = pack({ type: 'wayGroup', id: rid.id, offset });
        return new WayGroup(wgId, {
            type: 'wayGroup',
            id: rid.id,
            role,
            ways: ways.map(w => w.id),
        });
    }

    public startsWithNode: Id = '';
    public endsWithNode: Id = '';

    public get name(): string {
        return `${this.children[0].name}, ${this.role}`;
    }

    public get data(): OsmWayGroup {
        return this._data as OsmWayGroup;
    }

    public get role(): string {
        return this.data.role;
    }

    public constructor(id: Id, data: OsmWayGroup) {
        super(id, data);

        if (data.ways.length === 0) {
            throw new Error('Requires at least one way');
        }

        const wayIds = data.ways;
        for (const id of wayIds) {
            const w = get(id) as Way;
            if (!w || !this.add(w)) {
                throw new Error('Ways do not connect');
            }
        }

        const uid = unpack(id);
        const parentId = pack({ type: 'relation', id: uid.id });
        this.parentIds.add(parentId);
        const parent = get(parentId) as Relation | undefined;
        if (parent) {
            parent.addChildUnique(id);
            parent.wayGroups ??= new Map();
            parent.wayGroups.set(id, this);
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
        
        this.data.ways = this.childIds;
        return true;
    }
}