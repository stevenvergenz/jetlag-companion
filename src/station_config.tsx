import { ReactNode, useState, useEffect, useContext } from 'react';
import { CircleMarker, LayerGroup, Polygon, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { TreeNode } from './tree_node';
import { Context } from './context';
import { requestStations } from './overpass_api';
import { Relation, Way, Node } from './osm_element';

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
    const [ stations, setStations ] = useState([] as Relation[]);

    useEffect(() => {
        async function helper() {
            if (!path || path.length < 2) { return; }
            const res = await requestStations(path, useTransitStations, busTransferThreshold);
            setStations(res);
        }
        helper();
    }, [path, useTransitStations, busTransferThreshold]);

    function modeString(stopArea: Relation): string {
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

    function renderStation(stopArea: Relation): ReactNode {
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