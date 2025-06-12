import { Relation, Way, Node, getSyntheticId, unpack, TransportType } from './index';

export default class Station extends Relation {
    private _typeRanges = [0, 0, 0, 0];

    public constructor(platform: Way | Node) {
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

        this.add(platform);
    }

    public get name(): string {
        if (this.stopAreaEnd < this.stationEnd) {
            return this.childRefs[this.stopAreaEnd + 1].element!.name;
        } else if (this.platformEnd > 0) {
            return this.childRefs[0].element!.name;
        } else {
            return super.name;
        }
    }

    public get visuals(): (Way | Node)[] {
        const s = this.firstElementWithRole('station', Node);
        if (s) {
            return [s];
        }
        else {
            return this.allElementsWithRole('platform') as (Way | Node)[];
        }
    }

    /** @returns true if the platform is now part of the station */
    public tryAdd(platform: Way | Node): boolean {
        // validate the platform itself

        if (platform.transportType !== TransportType.Platform) {
            return false;
        }

        if (this.has(platform.id)) {
            return true;
        }

        // check if stop areas are in common

        const stopAreas = platform.parentRefs.flatMap(pRef => {
            const match = pRef.element instanceof Relation
                && pRef.role === 'platform'
                && pRef.element.transportType === TransportType.StopArea;
            return match ? [pRef.element as Relation] : [];
        });

        if (stopAreas.some(sa => this.has(sa.id))) {
            this.add(platform);
            return true;
        }

        // check if stations are in common

        const stations = stopAreas.flatMap(stopArea => {
            return stopArea.childRefs.flatMap(cRef => {
                const match = (cRef.element instanceof Way || cRef.element instanceof Node)
                    && cRef.role === ''
                    && cRef.element.transportType === TransportType.Station;
                return match ? [cRef.element as Way | Node] : [];
            });
        });

        if (stations.some(s => this.has(s.id))) {
            this.add(platform);
            return true;
        }

        return false;
    }

    private add(platform: Way | Node) {
        this.addChild(platform, 'platform', this.platformEnd++);

        // add any stop areas (above platforms)
        const stopAreas = platform.parentRefs.flatMap(pRef => {
            const matches = pRef.element instanceof Relation
                && pRef.role === 'platform' 
                && pRef.element.transportType === TransportType.StopArea
                && !this.has(pRef.id);
            return matches ? [pRef.element as Relation] : [];
        });

        for (const sa of stopAreas) {
            this.addChild(sa, 'stop_area', this.stopAreaEnd++);
        }

        // add any stations (below stop areas)
        const stations = stopAreas.flatMap(sa => {
            return sa.childRefs.flatMap(cRef => {
                const matches = (cRef.element instanceof Way || cRef.element instanceof Node)
                    && cRef.role === ''
                    && cRef.element.transportType === TransportType.Station
                    && !this.has(cRef.id);
                return matches ? [cRef.element as Way | Node] : [];
            });
        });

        for (const s of stations) {
            this.addChild(s, 'station', this.stationEnd++);
        }

        // add any routes that go through the platform
        const routes = platform.parentRefs.flatMap(pRef => {
            const matches = pRef.element instanceof Relation
                && pRef.role === 'platform'
                && pRef.element.transportType === TransportType.Route
                && !this.has(pRef.id);
            return matches ? [pRef.element as Relation] : [];
        });

        for (const route of routes) {
            this.addChild(route, 'route', this.routeEnd++);
        }

        // add any route masters for the added routes
        const routeMasters = routes.flatMap(route => {
            return route.parentRefs.flatMap(pRef => {
                const matches = pRef.element instanceof Relation
                    && pRef.element.transportType === TransportType.RouteMaster
                    && !this.has(pRef.id);
                return matches ? [pRef.element as Relation] : [];
            });
        });

        for (const routeMaster of routeMasters) {
            this.addChild(routeMaster, 'route_master', this.childRefs.length);
        }
    }

    private extendRange(index: number) {
        this._typeRanges = [
            ...this._typeRanges.slice(0, index),
            ...this._typeRanges.slice(index).map(n => n + 1),
        ];
    }


    private get stationEnd() {
        return this._typeRanges[0];
    }
    private set stationEnd(_: number) {
        this.extendRange(0);
    }

    private get stopAreaEnd() {
        return this._typeRanges[1];
    }
    private set stopAreaEnd(_: number) {
        this.extendRange(1);
    }

    private get platformEnd() {
        return this._typeRanges[2];
    }
    private set platformEnd(_: number) {
        this.extendRange(2);
    }

    private get routeEnd() {
        return this._typeRanges[3];
    }
    private set routeEnd(_: number) {
        this.extendRange(3);
    }
}