import Element from './element';
import { OsmWay } from './overpass_api';
import { Id } from './id';
import Node from './node';
import { get } from '../overpass_cache';
import { LatLngTuple } from 'leaflet';

export default class Way extends Element {
    public constructor(id: Id, data: OsmWay) {
        super(id, data);
    }

    public get data() { return this._data as OsmWay; }

    public get children(): Node[] {
        return this.childIds
            .map(id => get(id))
            .filter(e => e !== undefined) as Node[];
    }

    public get center(): LatLngTuple {
        const lats = this.children.map(n => n.lat);
        const lons = this.children.map(n => n.lon);
        return [
            (Math.max(...lats) + Math.min(...lats)) / 2,
            (Math.max(...lons) + Math.min(...lons)) / 2,
        ] as LatLngTuple;
    }
}
