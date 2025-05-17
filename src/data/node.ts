import { Element } from './element';
import { OsmElement, OsmNode } from './overpass_api';
import { Id } from './id';

export default class Node extends Element {
    public static isNode(e?: OsmElement): boolean {
        return e?.type === 'node';
    }

    public constructor(id: Id, data: OsmNode) {
        super(id, data);
        this.processInterests();
    }

    public get data() {
        return this._data as OsmNode;
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
