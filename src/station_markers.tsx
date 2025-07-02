import { ReactNode, useContext } from 'react';
import { PathOptions } from 'leaflet';
import { Circle, LayerGroup, CircleMarker, Tooltip } from 'react-leaflet';
import { SharedContext } from './context';
import { Id } from './data/index';
import { convertLength } from '@turf/turf';
import { ZoneSize } from './config';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 1,
};

const AreaStyle: PathOptions = {
    ...StationStyle,
    fillOpacity: 0.1,
    weight: 0,
};

const HoverStyle: PathOptions = {
    ...StationStyle,
    color: '#ff0000',
};
const HoverAreaStyle: PathOptions = {
    ...AreaStyle,
    color: '#ff0000',
}

export default function StationMarkers(): ReactNode {
    const {
        boundaryEditing, boundaryPoints,
        hovering, setHovering,
        busRouteThreshold, trainRouteThreshold,
        stations,
        zoneSize,
    } = useContext(SharedContext);

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

    const s = stations.filter(s => s.shouldShow({ busRouteThreshold, trainRouteThreshold }));
    const radius = zoneSize === ZoneSize.SmallMi ? convertLength(0.25, 'miles', 'meters') :
        zoneSize === ZoneSize.LargeMi ? convertLength(0.5, 'miles', 'meters') :
        zoneSize === ZoneSize.SmallKm ? 500 :
        1000;

    const zones = s.map(s =>
        <Circle
            center={[s.visual.lat, s.visual.lon]}
            radius={radius}
            key={`${s.id}-zone`}
            pathOptions={hovering === s.id ? HoverAreaStyle : AreaStyle}
        />
    );

    const markers = s.map(s =>
        <CircleMarker
            center={[s.visual.lat, s.visual.lon]}
            radius={3}
            key={`${s.id}-marker`}
            eventHandlers={{
                mouseover: hoverStart(s.id),
                mouseout: hoverEnd(s.id),
            }}
            pathOptions={hovering === s.id ? HoverStyle : StationStyle}
        >
            <Tooltip>
                <span className='font-bold'>{s.name}</span>
                {s.modeString()}
            </Tooltip>
        </CircleMarker>
    );
        
    if (boundaryPoints && !boundaryEditing) {
        return <>
            <LayerGroup attribution='<a target="_blank" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'>
                {zones}
            </LayerGroup>
            <LayerGroup attribution='<a target="_blank" href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'>
                {markers}
            </LayerGroup>
        </>;
    }
}