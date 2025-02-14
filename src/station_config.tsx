import { ReactNode, useState, useEffect, useContext } from 'react';
import { CircleMarker, LayerGroup, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { TreeNode } from './tree_node';
import { Context } from './context';
import { requestStations } from './overpass_api';
import { Node } from './osm_element';

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
    const [ stations, setStations ] = useState([] as Node[]);

    useEffect(() => {
        async function helper() {
            if (!path || path.length < 2) { return; }
            const res = await requestStations(path, useTransitStations, busTransferThreshold);
            setStations(res);
        }
        helper();
    }, [path, useTransitStations, busTransferThreshold]);

    function modeString(n: Node): string {
        const modes = [];
        if (n.isStation) {
            modes.push('Station');
        }
        if (n.isRail) {
            modes.push('Rail');
        }
        if (n.isBusStop) {
            modes.push(`Bus (${n.busRoutes.map(r => r.data.tags?.ref).join('/')})`);
        }
        return modes.join(', ');
    }

    if (path && !editing && show) {
        return <LayerGroup>
            {stations.map(n =>
                <CircleMarker key={n.id} center={[n.lat, n.lon]} radius={5} pathOptions={StationStyle}>
                    <Tooltip>
                        <p className='font-bold'>{n.name}</p>
                        <p>{modeString(n)}</p>
                    </Tooltip>
                </CircleMarker>
            )}
        </LayerGroup>;
    }
}