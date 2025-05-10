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

export abstract class Element {
    /** Maps child IDs to interested parent IDs */
    protected static interests = new Map<Id, Set<Id>>();

    public readonly id: Id;

    protected readonly _data: OsmElement;
    public get data(): OsmElement {
        return this._data;
    }

    public readonly parents = [] as ElementRef[];

    public readonly children = [] as ElementRef[];

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

    protected processInterests() {
        // populate child references
        for (const childRef of this.children) {
            childRef.element = get(childRef.id);
            if (childRef.element) {
                // if the child is already loaded, add self as a parent
                let backRef = childRef.element.parents.find(r => r.id === this.id);
                if (!backRef) {
                    backRef = { id: this.id, role: childRef.role };
                    childRef.element.parents.push(backRef);
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
                const ref = p?.children.find(r => r.id === this.id);
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
