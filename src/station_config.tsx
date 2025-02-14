import { ReactNode, useState, useEffect, useContext } from 'react';
import { CircleMarker, LayerGroup, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { TreeNode } from './tree_node';
import { Context } from './context';
import { getStations } from './overpass_api';
import { Node } from './osm_element';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.8,
};
const RailStyle: PathOptions = {
    ...StationStyle,
    fillColor: 'red',
};

const BusStyle: PathOptions = {
    ...StationStyle,
    fillColor: 'purple',
};

export function StationConfig(): ReactNode {
    const {
        showStations, setShowStations,
        useTransitStations, setUseTransitStations,
    } = useContext(Context);

    return <TreeNode id='stations' initiallyOpen={true}>
        <label className='font-bold'>
            <input type='checkbox' checked={showStations} onChange={e => setShowStations(e.target.checked)} />
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
    const { boundary, editingBoundary, showStations, useTransitStations } = useContext(Context);
    const [ rail, setRail ] = useState([] as Node[]);
    const [ bus, setBus ] = useState([] as Node[]);

    useEffect(() => {
        async function helper() {
            if (!boundary || boundary.length < 2) { return; }
            const res = await getStations(boundary, useTransitStations);
            setRail(res.filter(n => n.data.tags?.railway === 'station'));
            setBus(res.filter(n => n.data.tags?.highway === 'bus_stop'));
        }
        helper();
    }, [boundary, useTransitStations]);

    if (boundary && !editingBoundary && showStations) {
        return <LayerGroup>
            {rail.map(n =>
                <CircleMarker key={n.id} center={[n.lat, n.lon]} radius={5} pathOptions={RailStyle}>
                    <Tooltip>Rail: {n.name}</Tooltip>
                </CircleMarker>
            )}
            {bus.map(n =>
                <CircleMarker key={n.id} center={[n.lat, n.lon]} radius={5} pathOptions={BusStyle}>
                    <Tooltip>Bus: {n.name}</Tooltip>
                </CircleMarker>
            )}
        </LayerGroup>;
    }
}