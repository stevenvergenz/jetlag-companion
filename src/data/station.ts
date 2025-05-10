import { Id, getSyntheticId, unpack } from './id';
import { Element, TransportType } from './element';
import Relation from './relation';
import Way from './way';
import Node from './node';

export class Station extends Relation {
    private _typeRanges = [0, 0, 0, 0, 0];

    public constructor() {
        const id = getSyntheticId('relation');
        const uid = unpack(id);
        super(id, { 
            id: uid.id,
            type: 'relation',
            tags: {
                jetlag_synthetic: 'station',
            },
            members: [],
        });
    }

    public get visuals(): (Way | Node)[] {
        const s = this.firstElementWithRole<Node>('station', 'node');
        if (s) {
            return [s];
        }
        else {
            return this.allElementsWithRole<Way | Node>('platform');
        }
    }

    public add(platform: Way | Node) {
        // add the platform

        if (this.has(platform.id)) {
            return;
        }

        let uid = unpack(platform.id);
        this.data.members.splice(this.platformEnd++, 0, {
            ref: uid.id,
            type: uid.type,
            role: 'platform',
        });

        // add any stop areas

        const stopAreas = platform.parents.flatMap(ref => {
            if (!this.has(ref.id)
                && ref.id === platform.id
                && ref.element?.transportType === TransportType.StopArea) {
                return [ref.element];
            } else {
                return [];
            }
        });

        if (stopAreas.length === 0) {
            return;
        }

        for (const stopArea of stopAreas) {
            uid = unpack(stopArea.id);
            this.data.members.splice(this.stopAreaEnd++, 0, {
                ref: uid.id,
                type: uid.type,
                role: 'stop_area',
            });
        }


        // add any stations

        const stations = stopAreas.flatMap(sa => {
            return sa.children.flatMap(ref => {
                if (!this.has(ref.id)
                    && ref.element?.transportType === TransportType.Station) {
                    return [ref.element];
                } else {
                    return [];
                }
            });
        })

        if (stations.length === 0) {
            return;
        }

        for (const station of stations) {
            uid = unpack(station.id);
            this.data.members.splice(this.stationEnd++, 0, {
                ref: uid.id,
                type: uid.type,
                role: 'station',
            });
        }

        /*this.station = stopAreas
            .flatMap(s => s.children)
            .find(c => 
                (c instanceof Way || c instanceof Node) 
                && c.data.tags?.public_transport === 'station'
            ) as Way | Node | undefined;

        if (this.station) {
            this.stopAreas = findUp<Relation>('stop_area',
                new Map<Id, Element>([[this.station.id, this.station]]));
        }

        if (this.stopAreas.size > 0) {
            this.platforms = findDown('platform', this.stopAreas);
        }

        this.routes = findUp<Relation>('route', this.platforms);

        this.routeMasters = findUp<Relation>('route_master', this.routes);*/
    }

    private extendRange(index: number) {
        this._typeRanges = [
            ...this._typeRanges.slice(0, index),
            ...this._typeRanges.slice(index).map(n => n + 1),
        ];
    }

    private get platformStart() {
        return 0;
    }
    private get platformEnd() {
        return this._typeRanges[0];
    }
    private set platformEnd(_: number) {
        this.extendRange(0);
    }

    private get stopAreaStart() {
        return this.platformEnd;
    }
    private get stopAreaEnd() {
        return this._typeRanges[1];
    }
    private set stopAreaEnd(_: number) {
        this.extendRange(1);
    }

    private get stationStart() {
        return this.stopAreaEnd;
    }
    private get stationEnd() {
        return this._typeRanges[2];
    }
    private set stationEnd(_: number) {
        this.extendRange(2);
    }

    private get routeStart() {
        return this.stationEnd;
    }
    private get routeEnd() {
        return this._typeRanges[3];
    }
    private set routeEnd(_: number) {
        this.extendRange(3);
    }

    private get routeMasterStart() {
        return this.routeEnd;
    }
    private get routeMasterEnd() {
        return this._typeRanges.length;
    }
}