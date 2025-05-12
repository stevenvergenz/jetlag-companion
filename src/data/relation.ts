import { Element, ElementRef } from './element';
import Way from './way';
import Node from './node';
import { OsmElementType, OsmRelation } from './overpass_api';
import { Id, packFrom, unpack } from './id';
import { get } from '../overpass_cache';

export default class Relation extends Element {
    public static isRelation(e: Element): boolean {
        return e.data.type === 'relation';
    }
    
    public constructor(id: Id, data: OsmRelation) {
        super(id, data);

        for (const m of data.members) {
            const childRef: ElementRef = {
                id: packFrom(m),
                role: m.role,
            };

            this.children.push(childRef);
        }

        this.processInterests();
    }

    public get data() {
        return this._data as OsmRelation;
    }

    public has(id: Id): boolean {
        return this.children.findIndex(ref => ref.id === id) >= 0;
    }

    public roleOf(id: Id): string | undefined {
        const ref = this.children.find(ref => ref.id === id);
        return ref?.role;
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

    protected addChild(child: Element, role?: string, index?: number) {
        if (this.children.find(ref => ref.id === child.id && (!role || ref.role === role))) {
            return;
        }

        if (index === undefined) {
            index = this.children.length;
        }

        const uid = unpack(child.id);
        this.data.members.splice(index, 0, {
            ref: uid.id,
            type: uid.type,
            role: role ?? '',
        });

        super.addChild(child, role, index);
    }
}
