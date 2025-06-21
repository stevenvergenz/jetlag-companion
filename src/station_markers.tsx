import { ReactNode, useContext } from 'react';
import { PathOptions } from 'leaflet';
import { GeoJSON, LayerGroup, Tooltip } from 'react-leaflet';
import { SharedContext } from './context';
import { Station, Id } from './data/index';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.5,
};

const HoverStyle: PathOptions = {
    ...StationStyle,
    color: '#ff0000',
};

export function StationMarkers(): ReactNode {
    const {
        boundaryEditing, boundaryPoints,
        hovering, setHovering,
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

    function hoverStart(id: Id) {
        return () => {
            if (hovering !== id) {
                setHovering(id);
            }
        };
    }

    function hoverEnd(id: Id) {
        return () => {
            if (hovering === id) {
                setHovering('');
            }
        };
    }
    

    function renderStation(station: Station): ReactNode {
        return <GeoJSON
            key={station.id}
            data={station.toJSON()}
            pathOptions={hovering === station.id ? HoverStyle : StationStyle}
            eventHandlers={{
                click: () => console.log(station),
                mouseover: hoverStart(station.id),
                mouseout: hoverEnd(station.id),
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
        return <LayerGroup attribution='<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'>
            {s}
        </LayerGroup>;
    }
}