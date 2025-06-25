import { ReactNode, useContext } from 'react';
import { polygon, buffer, difference, featureCollection, point } from '@turf/turf';
import { Feature, GeometryObject } from 'geojson';
import { toKML } from '@placemarkio/tokml';
import { SharedContext } from './context';

// import { BoundaryConfig } from './boundary_config';
import { StationConfig } from './station_config';

export default function SideBar(): ReactNode {
    const {
        boundaryPoints,
        stations,
        busRouteThreshold, trainRouteThreshold,
    } = useContext(SharedContext);

    function saveToKml() {
        const innerPoly = polygon([boundaryPoints]);
        const outerPoly = buffer(innerPoly, 30, { units: 'miles' })!;
        const mask = difference(featureCollection([outerPoly, innerPoly]))!;
        mask.properties = { name: 'Game Boundary' };

        const stationGeo = stations.flatMap(s => {
            if (s.shouldShow({ busRouteThreshold, trainRouteThreshold })) {
                const p = point([s.visual.lon, s.visual.lat]);
                p.properties = { name: s.name, description: s.modeString() };
                return [p];
            } else {
                return [];
            }
        });

        const json = featureCollection([...stationGeo, mask] as Feature<GeometryObject>[]);
        const kml = toKML(json);
        
        const blob = URL.createObjectURL(new Blob([new TextEncoder().encode(kml)]));
        const link = document.createElement('a');
        link.href = blob;
        link.download = 'config.kml';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blob);
    }

    return <div className={
        'min-w-fit max-w-md overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch'}>
        <StationConfig />
        <button className='btn btn-primary' onClick={saveToKml}>
            Export To KML
        </button>
    </div>;
}