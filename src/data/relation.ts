import Element from './element';
import Way from './way';
import Node from './node';
import { OsmElementType, OsmRelation } from './overpass_api';
import { Id, packFrom } from './id';
import { get } from '../overpass_cache';

export default class Relation extends Element {
    private _indexLookup = new Map<Id, number>();

    public constructor(id: Id, data: OsmRelation) {
        super(id, data);
    }

    public get data() {
        return this._data as OsmRelation;
    }

    public indexOf(id: Id): number {
        const index = this.data.members.findIndex(m => packFrom(m) === id);
        if (index >= 0) {
            this._indexLookup.set(id, index);
        }
        return index;
    }

    public has(id: Id): boolean {
        return this.indexOf(id) >= 0;
    }

    public roleOf(id: Id): string | undefined {
        if (this.has(id)) {
            return this.data.members[this._indexLookup.get(id)!].role;
        }
        else {
            return undefined;
        }
    }

    public firstIdWithRole(role: string, type?: OsmElementType): Id | undefined {
        for (const m of this.data.members) {
            if (m.role === role && (!type || m.type == type)) {
                return packFrom(m);
            }
        }
        return undefined;
    }

    public allIdsWithRole(role: string, type?: OsmElementType): Id[] {
        return this.data.members
            .filter(m => m.role === role && (!type || m.type == type))
            .map(m => packFrom(m));
    }

    public firstElementWithRole<T extends Element = Element>(role: string, type?: OsmElementType): T | undefined {
        const id = this.firstIdWithRole(role, type);
        return id ? get(id) : undefined;
    }

    public firstRelationWithRole(role: string): Relation | undefined {
        return this.firstElementWithRole<Relation>(role, 'relation');
    }

    public firstWayWithRole(role: string): Way | undefined {
        return this.firstElementWithRole<Way>(role, 'way');
    }

    public firstNodeWithRole(role: string): Node | undefined {
        return this.firstElementWithRole<Node>(role, 'node');
    }

    public allElementsWithRole<T extends Element = Element>(role: string, type?: OsmElementType): T[] {
        return this.allIdsWithRole(role, type).map(id => get(id));
    }

    public allRelationsWithRole(role: string): Relation[] {
        return this.allElementsWithRole<Relation>(role, 'relation');
    }

    public allWaysWithRole(role: string): Way[] {
        return this.allElementsWithRole<Way>(role, 'way');
    }

    public allNodesWithRole(role: string): Node[] {
        return this.allElementsWithRole<Node>(role, 'node');
    }
}
