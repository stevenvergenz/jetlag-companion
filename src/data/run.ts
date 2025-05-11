import Relation from './relation';
import Way from './way';
import { Id, getSyntheticId, unpack } from './id';

export default class Run extends Relation {
    public constructor() {
        const id = getSyntheticId('relation');
        const uid = unpack(id);
        super(id, {
            id: uid.id,
            type: 'relation',
            tags: {
                jetlag_synthetic: 'run',
            },
            members: [],
        });
    }

    public add(way: Way): boolean {
        const firstNode = way.children[0].id;
        const lastNode = way.children[way.children.length - 1].id;

        if (this.children.length === 0) {
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
}