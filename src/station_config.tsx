import { ReactNode, useState, useEffect, useContext } from 'react';
import { CircleMarker, LayerGroup, FeatureGroup, Polygon, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { Id } from './id';
import { TreeNode } from './tree_node';
import { Context } from './context';
import { getByTransportTypeAsync } from './overpass_cache';
import { Element, Relation, Way, Node } from './element';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.8,
};

const busTypes = ['bus', 'trolleybus', 'tram'];
const trainTypes = ['train', 'subway', 'monorail', 'light_rail'];

class StationGroup {
    private static findUp<T extends Element>(tag: string, es: Map<Id, Element>): Map<Id, T> {
        return this.find(tag, [...es.values()].flatMap(e => e.parents));
    }
    
    private static findDown<T extends Element>(tag: string, es: Map<Id, Element>): Map<Id, T> {
        return this.find(tag, [...es.values()].flatMap(e => e.children));
    }

    private static find<T extends Element>(tag: string, es: Element[]): Map<Id, T> {
        return es
            .filter(e => [e.data.tags?.public_transport, e.data.tags?.type].includes(tag))
            .reduce((map, e) => {
                map.set(e.id, e as T);
                return map;
            }, new Map<Id, T>());
    }

    public station?: Way | Node;
    public stopAreas: Map<Id, Relation> = new Map();
    public platforms: Map<Id, (Way | Node)> = new Map();
    public routeMasters: Map<Id, Relation> = new Map();

    public get id(): Id {
        const repId = this.station?.id
            ?? this.stopAreas.values().next().value?.id
            ?? this.platforms.values().next().value?.id
            ?? 'unknown';
        return `station-${repId}`;
    }

    public get name(): string {
        return this.station?.name
            ?? this.stopAreas.values().next().value?.name
            ?? this.platforms.values().next().value?.name
            ?? '<Unknown>';
    }

    public get visuals(): (Way | Node)[] {
        return this.station ? [this.station] : [...this.platforms.values()];
    }

    public add(platform: Way | Node) {
        this.platforms.set(platform.id, platform);

        this.stopAreas = StationGroup.findUp<Relation>('stop_area', this.platforms);
        
        this.station = [...this.stopAreas.values()]
            .flatMap(s => s.children)
            .find(c => 
                (c instanceof Way || c instanceof Node) 
                && c.data.tags?.public_transport === 'station'
            ) as Way | Node | undefined;

        if (this.station) {
            this.stopAreas = StationGroup.findUp<Relation>('stop_area',
                new Map<Id, Element>([[this.station.id, this.station]]));
        }

        if (this.stopAreas.size > 0) {
            this.platforms = StationGroup.findDown('platform', this.stopAreas);
        }

        const routes = StationGroup.findUp<Relation>('route', this.platforms);

        this.routeMasters = StationGroup.findUp<Relation>('route_master', routes);
    }

    public has(element: Element): boolean {
        return this.platforms.has(element.id)
            || this.stopAreas.has(element.id)
            || this.station?.id === element.id;
    }
}

export function StationConfig(): ReactNode {
    const {
        stations: {
            show, setShow,
            busRouteThreshold, setBusRouteThreshold,
            trainRouteThreshold, setTrainRouteThreshold,
        },
        save,
    } = useContext(Context);

    useEffect(() => {
        save();
    }, [save, show, busRouteThreshold, trainRouteThreshold]);

    return <TreeNode id='stations' initiallyOpen={true}>
        <label className='font-bold'>
            <input type='checkbox' checked={show} onChange={e => setShow(e.target.checked)} />
            &nbsp; Stations
        </label>
        <TreeNode id='station-settings' initiallyOpen={true}>
            <span className='font-bold'>Settings</span>
            <label>
                <input type='number' min='0' max='10'
                    value={trainRouteThreshold} onChange={e => setTrainRouteThreshold(e.target.valueAsNumber)}/>
                &nbsp; Train routes
            </label>
            <label>
                <input type='number' min='0' max='10'
                    value={busRouteThreshold} onChange={e => setBusRouteThreshold(e.target.valueAsNumber)}/>
                &nbsp; Bus routes
            </label>
        </TreeNode>
    </TreeNode>;
}

export function StationMarkers(): ReactNode {
    const {
        boundary: { editing, path },
        stations: { show, busRouteThreshold, trainRouteThreshold },
    } = useContext(Context);
    const [ stations, setStations ] = useState([] as StationGroup[]);

    useEffect(() => {
        async function helper() {
            if (!path || path.length < 2) { return; }

            const platforms = await getByTransportTypeAsync<Way | Node>(
                path, 
                'platform',
                { request: true },
            );

            const stations = [] as StationGroup[];
            for (const platform of platforms) {
                let station = stations.find(s => s.has(platform));
                if (!station) {
                    station = new StationGroup();
                    stations.push(station);
                }
                station.add(platform);
            }
            setStations(stations);
        }
        helper();
    }, [path, busRouteThreshold]);

    function modeString(station: StationGroup): ReactNode {
        const modes = [] as string[];

        if (station.station) {
            modes.push('Station');
        }

        if ([...station.platforms.values()].some(p => p.data.tags?.railway === 'platform')) {
            const routeStr = [...station.routeMasters.values()]
                .filter(rm => trainTypes.includes(rm.data.tags!.route_master))
                .map(r => r.data.tags?.ref)
                .join(', ');
            modes.push(`Rail (${routeStr})`);
        }

        if ([...station.platforms.values()].some(p => p.data.tags?.highway === 'bus_stop')) {
            const routeStr = [...station.routeMasters.values()]
                .filter(rm => busTypes.includes(rm.data.tags!.route_master))
                .map(r => r.data.tags?.ref)
                .join(', ');
            modes.push(`Bus (${routeStr})`);
        }

        return modes.map(m => <p>{m}</p>);
    }

    function renderStation(station: StationGroup): ReactNode {
        const visuals = [] as ReactNode[];
        for (const v of station.visuals) {
            if (v instanceof Way) {
                visuals.push(<Polygon key={v.id}
                    positions={v.children.map(c => [c.lat, c.lon])}
                    pathOptions={StationStyle}>
                </Polygon>);
            }
            else if (v instanceof Node) {
                visuals.push(<CircleMarker key={v.id}
                    center={[v.lat, v.lon]}
                    radius={5}
                    pathOptions={StationStyle}>
                </CircleMarker>);
            }
        }
        
        return <FeatureGroup key={station.id}>
            {visuals}
            <Tooltip>
                <p className='font-bold'>{station.name}</p>
                {modeString(station)}
            </Tooltip>
        </FeatureGroup>;
    }

    function shouldShow(station: StationGroup): boolean {
        const types = new Map<string, number>();
        for (const rm of station.routeMasters.values()) {
            const type = rm.data.tags!.route_master;
            types.set(type, (types.get(type) ?? 0) + 1);
        }

        const otherTypes = [...types.keys()].filter(t => !busTypes.includes(t) && !trainTypes.includes(t));

        return busRouteThreshold > 0 && busRouteThreshold <=
            busTypes.map(t => types.get(t) ?? 0).reduce((a, b) => a + b)
        || trainRouteThreshold > 0 && trainRouteThreshold <=
            trainTypes.map(t => types.get(t) ?? 0).reduce((a, b) => a + b)
        || otherTypes.length > 0;
    }

    if (path && !editing && show) {
        return <LayerGroup>
            {stations.filter(shouldShow).map(s => renderStation(s))}
        </LayerGroup>;
    }
}