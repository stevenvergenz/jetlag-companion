import Element from './element';
import Way from './way';
import { OsmRelation } from './overpass_api';
import { Id, unpack } from './id';
import HierarchyHelper from './hierarchy_helper';

export default class Relation extends Element {
    public wayGroups?: Map<Id, WayGroup>;

    public constructor(id: Id, data: OsmRelation) {
        super(id, data);
    }

    public get data() {
        return this._data as OsmRelation;
    }

    public calcWayGroups() {
        if (this.wayGroups) {
            return;
        }

        const wayIds = this.childIds.filter(id => unpack(id).type === 'way');
        const ways = this.children.filter(e => e instanceof Way);
        if (ways.length !== wayIds.length) {
            return;
        }

        console.log(`[graph] Calculating waygroups for ${this.id} with ${ways.length} ways`);
        this.wayGroups = new Map();
        for (const w of ways) {
            HierarchyHelper.fulfillInterestRelationWay(w, this);
        }
    }

    public async getWayGroupsAsync(): Promise<WayGroup[]> {
        const wayIds = this.childIds.filter(id => unpack(id).type === 'way');
        await getAsync(wayIds);
        this.calcWayGroups();
        return [...this.wayGroups!.values()];
    }
}
