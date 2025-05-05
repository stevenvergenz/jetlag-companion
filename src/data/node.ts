import Element from './element';
import { OsmNode } from './overpass_api';
import { Id } from './id';

export default class Node extends Element {
    public constructor(id: Id, data: OsmNode) {
        super(id, data);
    }

    public get data() {
        return this._data as OsmNode;
    }

    public get lat() { return this.data.lat; }
    public get lon() { return this.data.lon; }
}
