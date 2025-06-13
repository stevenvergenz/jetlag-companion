import { Element, ElementRef, ElementCtor } from './element';
import { OsmElement, OsmRelation } from './overpass_api';
import { Id, packFrom, unpack } from './id';

export default class Relation extends Element {
    public constructor(id: Id, data: OsmRelation) {
        super(id, data);

        for (const m of data.members) {
            const childRef: ElementRef = {
                id: packFrom(m),
                role: m.role,
            };

            this.childRefs.push(childRef);
        }

        this.processInterests();
    }

    public get data() {
        return this._data as OsmRelation;
    }

    public has(id: Id): boolean {
        return this.childRefs.findIndex(ref => ref.id === id) >= 0;
    }

    public firstElementWithRole<T extends Element, U extends OsmElement>(role: string, t?: ElementCtor<T, U>): T | undefined {
        for (const ref of this.childRefs) {
            if (ref.role === role && (!t || ref.element instanceof t)) {
                return ref.element as T | undefined;
            }
        }
    }

    public allElementsWithRole<T extends Element, U extends OsmElement>(role: string, t?: ElementCtor<T, U>): T[] {
        const ret: T[] = [];
        for (const ref of this.childRefs) {
            if (ref.role === role && (!t || ref.element instanceof t)) {
                ret.push(ref.element as T);
            }
        }
        return ret;
    }

    protected addChild(child: Element, role?: string, index?: number) {
        if (this.childRefs.find(ref => ref.id === child.id && (!role || ref.role === role))) {
            return;
        }

        if (index === undefined) {
            index = this.childRefs.length;
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
