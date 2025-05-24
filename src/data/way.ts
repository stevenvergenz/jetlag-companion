import { Element, ElementRef } from './element';
import { OsmWay } from './overpass_api';
import { Id, pack } from './id';
import Node from './node';
import { LatLngTuple } from 'leaflet';

export default class Way extends Element {
    public constructor(id: Id, data: OsmWay) {
        super(id, data);

        for (const numId of data.nodes) {
            const ref: ElementRef = {
                id: pack({ id: numId, type: 'node' }),
            };

            this.childRefs.push(ref);
        }

        this.processInterests();
    }

    public get data() { return this._data as OsmWay; }

    public get center(): LatLngTuple {
        const lats = this.childRefs.flatMap(ref => {
            if (ref.element instanceof Node) {
                return [ref.element.lat];
            }
            else {
                return [];
            }
        });

        const lons = this.childRefs.flatMap(ref => {
            if (ref.element instanceof Node) {
                return [ref.element.lon];
            }
            else {
                return [];
            }
        });

        return [
            (Math.max(...lats) + Math.min(...lats)) / 2,
            (Math.max(...lons) + Math.min(...lons)) / 2,
        ] as LatLngTuple;
    }

    protected addChild(child: Element, role?: string, index?: number) {
        if (index === undefined) {
            index = this.childRefs.length;
        }

        if (!(child instanceof Node) || index > this.childRefs.length) {
            return;
        }

        this.data.nodes.splice(index, 0, child.data.id);

        super.addChild(child, role, index);
    }
}
