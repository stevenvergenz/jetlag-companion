import { ReactNode, useState, useEffect, useContext } from 'react';
import { CircleMarker, LayerGroup, Polygon, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { Id } from './id';
import { TreeNode } from './tree_node';
import { Context } from './context';
import { getByTransportTypeAsync } from './overpass_cache';
import { Element, Relation, Way, Node } from './element';

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

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.8,
};

export function StationConfig(): ReactNode {
    const {
        stations: {
            show, setShow,
            useTransitStations, setUseTransitStations,
            busTransferThreshold: busStopThreshold, setBusTransferThreshold: setBusStopThreshold,
        },
    } = useContext(Context);

    return <TreeNode id='stations' initiallyOpen={true}>
        <label className='font-bold'>
            <input type='checkbox' checked={show} onChange={e => setShow(e.target.checked)} />
            &nbsp; Stations
        </label>
        <TreeNode id='station-settings' initiallyOpen={true}>
            <span className='font-bold'>Settings</span>
            <label>
                <input type='checkbox'
                    checked={useTransitStations} onChange={e => setUseTransitStations(e.target.checked)} />
                &nbsp; Transit stations
            </label>
            <label>
                <input type='number' min='0' max='5'
                    value={busStopThreshold} onChange={e => setBusStopThreshold(e.target.valueAsNumber)}/>
                &nbsp; Bus transfers
            </label>
        </TreeNode>
    </TreeNode>;
}

export function StationMarkers(): ReactNode {
    const {
        boundary: { editing, path },
        stations: { show, useTransitStations, busTransferThreshold },
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
    }, [path, useTransitStations, busTransferThreshold]);

    function modeString(station: StationGroup): string {
        const modes = [];
        const stations = stopArea.children.filter(c => c.data.tags?.public_transport === 'station');
        if (stations.length > 0) {
            modes.push('Station');
            const areas = stations
                .flatMap(s => s.parents)
                .filter(p => p instanceof Relation && p.data.tags?.public_transport === 'stop_area');
            
            if (areas.flatMap(a => a.children).some(c => c.data.tags?.railway !== undefined)) {
                modes.push('Rail');
            }
            if (areas.flatMap(a => a.children).some(c => c.data.tags?.highway === 'bus_stop')) {
                modes.push(`Bus`);
            }
        }
        else {
            if (stopArea.children.some(c => c.data.tags?.railway !== undefined)) {
                modes.push('Rail');
            }
            if (stopArea.children.some(c => c.data.tags?.highway === 'bus_stop')) {
                modes.push(`Bus`);
            }
        }
        return modes.join(', ');
    }

    function renderStation(station: StationGroup): ReactNode {
        const marker = stopArea.children.find(c => c.data.tags?.public_transport === 'station')
            ?? stopArea.children.find(c => c.data.tags?.public_transport === 'platform');

        if (marker instanceof Node) {
            return <CircleMarker key={marker.id}
                center={[marker.lat, marker.lon]}
                radius={5}
                pathOptions={StationStyle}>
                <Tooltip>
                    <p className='font-bold'>{stopArea.name}</p>
                    <p>{modeString(stopArea)}</p>
                </Tooltip>
            </CircleMarker>;
        }
        else if (marker instanceof Way) {
            return <Polygon key={marker.id}
                positions={marker.children.map(c => [c.lat, c.lon])}
                pathOptions={StationStyle}>
                <Tooltip>
                    <p className='font-bold'>{stopArea.name}</p>
                    <p>{modeString(stopArea)}</p>
                </Tooltip>
            </Polygon>;
        }
    }

    if (path && !editing && show) {
        return <LayerGroup>
            {stations.map(s => renderStation(s))}
        </LayerGroup>;
    }
}