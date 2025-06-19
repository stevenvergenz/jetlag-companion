import { ReactNode, useContext } from 'react';
import { point, featureCollection } from '@turf/turf';
import { FeatureCollection } from 'geojson';
import { PathOptions } from 'leaflet';
import { GeoJSON, LayerGroup, Tooltip } from 'react-leaflet';
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
        boundaryEditing, boundaryPoints,
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
        const json = featureCollection(
            [point([station.visual.lon, station.visual.lat])],
            { id: station.id },
        );
        return <GeoJSON
            key={station.id}
            data={json as FeatureCollection}
            pathOptions={hovering === station.id ? HoverStyle : StationStyle}
            eventHandlers={{
                click: () => {
                    console.log(station);
                    // setHovering(station.id);
                },
                mouseover: () => {
                    // setHovering(station.id);
                },
                mouseout: () => {
                    // setHovering('');
                },
            }}
        >
            <Tooltip>
                <p className='font-bold'>{station.name}</p>
                {modeString(station)}
            </Tooltip>
        </GeoJSON>;
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
        
    if (boundaryPoints && !boundaryEditing && showStations) {
        return <LayerGroup>
            {s}
        </LayerGroup>;
    }
}