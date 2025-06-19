import { Relation, Way, Node, getSyntheticId, unpack, TransportType } from './index';
import { memCacheId } from '../util/overpass_cache';
import { LatLngTuple } from 'leaflet';
import { FeatureCollection, Feature, GeometryObject } from 'geojson';
import { featureCollection, point, circle } from '@turf/turf';

const busTypes = ['bus', 'trolleybus', 'tram'];
const trainTypes = ['train', 'subway', 'monorail', 'light_rail'];

export default class Station extends Relation {
    private _typeRanges = [0, 0, 0, 0, 0];

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

    private _visual: Node | undefined;
    public get visual(): Node {
        if (this._visual) {
            return this._visual;
        }

        const osmStation = this.firstElementWithRole('station');
        if (osmStation instanceof Node) {
            this._visual = osmStation;
            return this._visual;
        }
        
        let center: LatLngTuple;
        if (osmStation instanceof Way) {
            center = osmStation.center;
        } else {
            const platforms = this.allElementsWithRole('platform');
            let latSum = 0, lonSum = 0;
            for (const platform of platforms) {
                if (platform instanceof Node) {
                    latSum += platform.lat;
                    lonSum += platform.lon;
                } else if (platform instanceof Way) {
                    const center = platform.center;
                    latSum += center[0];
                    lonSum += center[1];
                }
            }
            center = [latSum / platforms.length, lonSum / platforms.length];
        }

        const id = getSyntheticId('node');
        this._visual = new Node(id, {
            type: 'node',
            id: unpack(id).id,
            lat: center[0],
            lon: center[1],
        });
        memCacheId.set(id, this._visual);
        this.addChild(this._visual, 'visual', this.childRefs.length);

        return this._visual;
    }

    private _connections: Map<string, Set<string>> | undefined;
    public get connections(): Map<string, Set<string>> {
        if (this._connections) {
            return this._connections;
        }

        // total route masters to this station
        const types = new Map<string, Set<string>>();
    
        for (const rm of this.allElementsWithRole('route_master', Relation)) {
            const type = rm.data.tags!.route_master;
            const routes = types.get(type) ?? new Set<string>();
            routes.add(rm.data.tags?.ref ?? rm.data.tags?.name ?? 'unknown');
            types.set(type, routes);
        }
    
        // total unmastered routes to this station
        for (const r of this.allElementsWithRole('route', Relation)
            .filter(r => r.parentRefs.some(pRef => pRef.role === 'route_master'))
        ) {
            const type = r.data.tags!.route;
            const routes = types.get(type) ?? new Set<string>();
            routes.add(r.data.tags?.ref ?? r.data.tags?.name ?? 'unknown');
            types.set(type, routes);
        }
    
        this._connections = types;
        return this._connections;
    }

    public shouldShow(
        { busRouteThreshold, trainRouteThreshold }: { busRouteThreshold: number, trainRouteThreshold: number },
    ): boolean {
        const otherTypes = [...this.connections.keys()].filter(t => !busTypes.includes(t) && !trainTypes.includes(t));
    
        return busRouteThreshold > 0 && busRouteThreshold <=
            busTypes.map(t => this.connections.get(t)?.size ?? 0).reduce((a, b) => a + b)
        || trainRouteThreshold > 0 && trainRouteThreshold <=
            trainTypes.map(t => this.connections.get(t)?.size ?? 0).reduce((a, b) => a + b)
        || otherTypes.length > 0;
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

    public toJSON(): FeatureCollection {
        return featureCollection(
            [
                point([this.visual.lon, this.visual.lat]),
                circle([this.visual.lon, this.visual.lat], 0.5, { units: 'miles' }),
            ] as Feature<GeometryObject>[],
            { id: this.id },
        );
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
            this.addChild(routeMaster, 'route_master', this.routeMasterEnd++);
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

    private get routeMasterEnd() {
        return this._typeRanges[4];
    }
    private set routeMasterEnd(_: number) {
        this.extendRange(4);
    }
}