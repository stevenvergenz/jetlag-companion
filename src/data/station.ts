import { getSyntheticId, unpack } from './id';
import { TransportType } from './element';
import Relation from './relation';
import Way from './way';
import Node from './node';
import { OsmElement } from './overpass_api';

export class Station extends Relation {
    public static isStation(e: OsmElement): boolean {
        return e.type === 'relation' && e.tags?.jetlag_synthetic === 'station';
    }

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

        // add any stop areas (above platforms)

        const directStopAreas = platform.parents.flatMap(ref => {
            if (!this.has(ref.id)
                && ref.element?.transportType === TransportType.StopArea) {
                return [ref.element];
            } else {
                return [];
            }
        });

        if (directStopAreas.length === 0) {
            return;
        }

        for (const stopArea of directStopAreas) {
            uid = unpack(stopArea.id);
            this.data.members.splice(this.stopAreaEnd++, 0, {
                ref: uid.id,
                type: uid.type,
                role: 'stop_area',
            });
        }


        // add any stations (below stop areas)

        const stations = directStopAreas.flatMap(sa => {
            return sa.children.flatMap(ref => {
                if (!this.has(ref.id)
                    && ref.element?.transportType === TransportType.Station) {
                    return [ref.element];
                } else {
                    return [];
                }
            });
        });

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

        // add any additional stop areas (above stations)

        const indirectStopAreas = stations.flatMap(s => {
            return s.parents.flatMap(ref => {
                if (!this.has(ref.id)
                    && ref.element?.transportType === TransportType.StopArea) {
                    return [ref.element];
                } else {
                    return [];
                }
            });
        });

        if (indirectStopAreas.length === 0) {
            return;
        }

        for (const stopArea of indirectStopAreas) {
            uid = unpack(stopArea.id);
            this.data.members.splice(this.stopAreaEnd++, 0, {
                ref: uid.id,
                type: uid.type,
                role: 'stop_area',
            });
        }

        // add any additional platforms (below stop areas)

        const indirectPlatforms = indirectStopAreas.flatMap(sa => {
            return sa.children.flatMap(ref => {
                if (!this.has(ref.id)
                    && ref.element?.transportType === TransportType.Platform) {
                    return [ref.element];
                } else {
                    return [];
                }
            });
        });

        if (indirectPlatforms.length === 0) {
            return;
        }

        for (const ip of indirectPlatforms) {
            uid = unpack(ip.id);
            this.data.members.splice(this.platformEnd++, 0, {
                ref: uid.id,
                type: uid.type,
                role: 'platform',
            });
        }

        // routes

        const routes = [platform, ...indirectPlatforms].flatMap(p => {
            return p.parents.flatMap(ref => {
                if (!this.has(ref.id)
                    && ref.element?.transportType === TransportType.Route) {
                    return [ref.element];
                } else {
                    return [];
                }
            });
        });

        if (routes.length === 0) {
            return;
        }

        for (const route of routes) {
            uid = unpack(route.id);
            this.data.members.splice(this.routeEnd++, 0, {
                ref: uid.id,
                type: uid.type,
                role: 'route',
            });
        }

        // route masters

        const masters = routes.flatMap(r => {
            return r.parents.flatMap(ref => {
                if (!this.has(ref.id)
                    && ref.element?.transportType === TransportType.RouteMaster) {
                    return [ref.element];
                } else {
                    return [];
                }
            });
        });

        if (masters.length === 0) {
            return;
        }

        for (const master of masters) {
            uid = unpack(master.id);
            this.data.members.push({
                ref: uid.id,
                type: uid.type,
                role: 'route_master',
            });
        }
    }

    private extendRange(index: number) {
        this._typeRanges = [
            ...this._typeRanges.slice(0, index),
            ...this._typeRanges.slice(index).map(n => n + 1),
        ];
    }

    private get platformEnd() {
        return this._typeRanges[0];
    }
    private set platformEnd(_: number) {
        this.extendRange(0);
    }

    private get stopAreaEnd() {
        return this._typeRanges[1];
    }
    private set stopAreaEnd(_: number) {
        this.extendRange(1);
    }

    private get stationEnd() {
        return this._typeRanges[2];
    }
    private set stationEnd(_: number) {
        this.extendRange(2);
    }

    private get routeEnd() {
        return this._typeRanges[3];
    }
    private set routeEnd(_: number) {
        this.extendRange(3);
    }
}