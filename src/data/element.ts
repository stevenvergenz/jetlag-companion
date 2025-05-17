import { OsmElement } from "./overpass_api";
import { Id } from './id';
import { get } from "../overpass_cache";

export enum TransportType {
    Platform,
    StopArea,
    Station,
    Route,
    RouteMaster,
}

export type ElementRef = {
    id: Id,
    role?: string,
    element?: Element,
};

export type TypedElementRef<T extends Element> = {
    id: Id,
    role?: string,
    element: T,
};

export abstract class Element {
    /** Maps child IDs to interested parent IDs */
    protected static interests = new Map<Id, Set<Id>>();

    public readonly id: Id;

    protected readonly _data: OsmElement;
    public get data(): OsmElement {
        return this._data;
    }

    public readonly parentRefs = [] as ElementRef[];

    public readonly childRefs = [] as ElementRef[];

    public get firstChildRef() {
        return this.childRefs[0];
    }

    public get lastChildRef() {
        return this.childRefs[this.childRefs.length - 1];
    }

    public get firstChild() {
        return this.firstChildRef?.element;
    }

    public get lastChild() {
        return this.lastChildRef?.element;
    }

    public get name(): string {
        return this._data?.tags?.['name'] 
            ?? this._data?.tags?.['description'] 
            ?? this._data?.tags?.['ref'] 
            ?? '<unnamed>';
    }

    public get transportType(): TransportType | undefined {
        if (this.data.tags?.public_transport === 'platform') {
            return TransportType.Platform;
        } else if (this.data.tags?.public_transport === 'stop_area') {
            return TransportType.StopArea;
        } else if (this.data.tags?.public_transport === 'station') {
            return TransportType.Station;
        } else if (this.data.tags?.type === 'route') {
            return TransportType.Route;
        } else if (this.data.tags?.type === 'route_master') {
            return TransportType.RouteMaster;
        } else {
            return undefined;
        }
    }

    public constructor(id: Id, data: OsmElement) {
        this.id = id;
        this._data = data;
    }

    public childRefsOfType<T extends Element, U extends OsmElement>(t: new (_: Id, __: U) => T) {
        return this.childRefs.flatMap(ref => {
            if (ref.element instanceof t) {
                return [ref as TypedElementRef<T>];
            } else {
                return [];
            }
        });
    }

    public parentRefsOfType<T extends Element, U extends OsmElement>(t: new (_: Id, __: U) => T) {
        return this.parentRefs.flatMap(ref => {
            if (ref.element instanceof t) {
                return [ref as TypedElementRef<T>];
            } else {
                return [];
            }
        });
    }

    public childrenOfType<T extends Element, U extends OsmElement>(t: new (_: Id, __: U) => T) {
        return this.childRefs.flatMap(ref => {
            if (ref.element instanceof t) {
                return [ref.element as T];
            } else {
                return [];
            }
        });
    }

    public parentsOfType<T extends Element, U extends OsmElement>(t: new (_: Id, __: U) => T) {
        return this.parentRefs.flatMap(ref => {
            if (ref.element instanceof t) {
                return [ref.element as T];
            } else {
                return [];
            }
        });
    }

    protected addChild(child: Element, role?: string, index?: number) {
        if (index === undefined) {
            index = this.childRefs.length;
        }

        if (index > this.childRefs.length
            || this.childRefs.find(ref => 
                ref.id === child.id && (!role || ref.role === role))
        ) {
            return;
        }

        this.childRefs.splice(index, 0, {
            id: child.id,
            role,
            element: child,
        });

        const backRef = child.parentRefs.find(ref => ref.id === this.id);
        if (!backRef || backRef.role !== role) {
            child.parentRefs.push({
                id: this.id,
                role,
                element: this,
            });
        }
    }

    protected addParent(parent: Element, role?: string) {
        parent.addChild(this, role);
    }

    protected processInterests() {
        // populate child references
        for (const childRef of this.childRefs) {
            childRef.element = get(childRef.id);
            if (childRef.element) {
                // if the child is already loaded, add self as a parent
                let backRef = childRef.element.parentRefs.find(r => r.id === this.id);
                if (!backRef) {
                    backRef = { id: this.id, role: childRef.role };
                    childRef.element.parentRefs.push(backRef);
                }
                backRef.element = this;
            } else {
                // if it isn't yet loaded, mark self as intested so we'll be updated when it does load
                const interestedParents = Element.interests.get(childRef.id);
                if (interestedParents) {
                    interestedParents.add(this.id);
                } else {
                    Element.interests.set(childRef.id, new Set([this.id]));
                }
            }
        }

        // populate parent references
        const parentIds = Element.interests.get(this.id);
        if (parentIds) {
            for (const parentId of parentIds) {
                const p: Element | undefined = get(parentId);
                const ref = p?.childRefs.find(r => r.id === this.id);
                if (ref) {
                    ref.element = this;
                    parentIds.delete(parentId);
                }
            }

            if (parentIds.size === 0) {
                Element.interests.delete(this.id);
            }
        }
    }
}
