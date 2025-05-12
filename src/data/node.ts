import { Element } from './element';
import { OsmNode } from './overpass_api';
import { Id } from './id';

export default class Node extends Element {
    public static isNode(e: Element): boolean {
        return e.data.type === 'node';
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

    protected addChild(child: Element, role?: string, index?: number) {
        throw new Error('Nodes cannot have children');
    }
}
