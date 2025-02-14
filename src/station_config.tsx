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
        stations: { show, setShow, useTransitStations, setUseTransitStations },
    } = useContext(Context);

    return <TreeNode id='stations' initiallyOpen={true}>
        <label className='font-bold'>
            <input type='checkbox' checked={show} onChange={e => setShow(e.target.checked)} />
            &nbsp; Stations
        </label>
        <TreeNode id='station-settings' initiallyOpen={true}>
            <span className='font-bold'>Settings</span>
            <TreeNode id='station-rail' initiallyOpen={true}>
                <label>
                    <input type='checkbox'
                        checked={useTransitStations} onChange={e => setUseTransitStations(e.target.checked)} />
                    &nbsp; Transit stations
                </label>
            </TreeNode>
        </TreeNode>
    </TreeNode>;
}

export function StationMarkers(): ReactNode {
    const {
        boundary: { editing, path },
        stations: { show, useTransitStations },
    } = useContext(Context);
    const [ stations, setStations ] = useState([] as Node[]);

    useEffect(() => {
        async function helper() {
            if (!path || path.length < 2) { return; }
            const res = await requestStations(path, useTransitStations, 1);
            setStations(res);
        }
        helper();
    }, [path, useTransitStations]);

    if (path && !editing && show) {
        return <LayerGroup>
            {stations.map(n =>
                <CircleMarker key={n.id} center={[n.lat, n.lon]} radius={5} pathOptions={StationStyle}>
                    <Tooltip>
                        <p className='font-bold'>{n.name}</p>
                        <span>{[
                            n.isStation ? 'Station' : '',
                            n.isRail ? 'Rail' : '',
                        ].join(', ')}
                        </span>
                    </Tooltip>
                </CircleMarker>
            )}
        </LayerGroup>;
    }
}