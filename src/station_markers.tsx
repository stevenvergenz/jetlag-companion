import { ReactNode, useContext } from 'react';
import { PathOptions } from 'leaflet';
import { FeatureGroup, LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import { SharedContext } from './context';
import { Station } from './data/index';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.8,
};

const HoverStyle: PathOptions = {
    ...StationStyle,
    color: '#ff0000',
};

export function StationMarkers(): ReactNode {
    const {
        boundaryEditing, boundaryPath,
        hovering,
        showStations, busRouteThreshold, trainRouteThreshold,
        stations,
    } = useContext(SharedContext);

    function modeString(station: Station): ReactNode {
        const modes = [] as string[];

        if (station.firstElementWithRole('station')) {
            modes.push('Station');
        }

        for (const [type, connections] of station.connections.entries()) {
            modes.push(`${type} (${[...connections].join(', ')})`);
        }

        return modes.map(m => <p key={`${station.id}-${m}`}>{m}</p>);
    }

    function renderStation(station: Station): ReactNode {
        return <FeatureGroup key={station.id}>
            <CircleMarker
                center={[station.visual.lat, station.visual.lon]}
                radius={5}
                pathOptions={hovering === station.id ? HoverStyle : StationStyle}
                eventHandlers={{click: () => console.log(station)}}>
            </CircleMarker>
            <Tooltip>
                <p className='font-bold'>{station.name}</p>
                {modeString(station)}
            </Tooltip>
        </FeatureGroup>;
    }

    const s = stations.flatMap(s => {
        return hovering !== s.id && s.shouldShow({ busRouteThreshold, trainRouteThreshold })
            ? [renderStation(s)] 
            : [];
    });

    const hoveredStation = stations.find(s => s.id === hovering);
    if (hoveredStation && hoveredStation.shouldShow({ busRouteThreshold, trainRouteThreshold })) {
        s.push(renderStation(hoveredStation));
    }
        
    if (boundaryPath && !boundaryEditing && showStations) {
        return <LayerGroup>
            {s}
        </LayerGroup>;
    }
}