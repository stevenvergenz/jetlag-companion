import { useContext } from 'react';
import { polygon, buffer, difference, featureCollection, point, convertLength, circle } from '@turf/turf';
import { Feature, GeometryObject } from 'geojson';
import { toKML } from '@placemarkio/tokml';
import { SharedContext } from '../context';
import { ZoneSize } from '../config';

export default function ExportTab() {
    const {
        boundaryPoints,
        stations,
        busRouteThreshold, trainRouteThreshold,
        zoneSize,
        save,
    } = useContext(SharedContext);

    function saveToKml() {
        const innerPoly = polygon([boundaryPoints]);
        const outerPoly = buffer(innerPoly, 30, { units: 'miles' })!;
        const mask = difference(featureCollection([outerPoly, innerPoly]))!;
        mask.properties = { name: 'Game Boundary' };


        const radius = zoneSize === ZoneSize.SmallMi ? convertLength(0.25, 'miles', 'meters') :
            zoneSize === ZoneSize.LargeMi ? convertLength(0.5, 'miles', 'meters') :
            zoneSize === ZoneSize.SmallKm ? 500 :
            1000;
        const stationZones = stations.flatMap(s => {
            if (s.shouldShow({ busRouteThreshold, trainRouteThreshold })) {
                const c = circle([s.visual.lon, s.visual.lat], radius, {
                    units: 'meters',
                    properties: { name: s.name, description: s.modeString() },
                });
                return [c];
            } else {
                return [];
            }
        })

        const stationGeo = stations.flatMap(s => {
            if (s.shouldShow({ busRouteThreshold, trainRouteThreshold })) {
                const p = point([s.visual.lon, s.visual.lat]);
                p.properties = { name: s.name, description: s.modeString() };
                return [p];
            } else {
                return [];
            }
        });

        const json = featureCollection([...stationGeo, ...stationZones, mask] as Feature<GeometryObject>[]);
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

    function handleZoneSizeChange(event: React.ChangeEvent<HTMLSelectElement>) {
        const value = event.target.value as ZoneSize;
        save({
            stations: {
                zoneSize: value,
            },
        })
    }

    return <div className="flex flex-col items-center justify-center h-full p-4">
        <h2>Appearance</h2>
        <p>
            Before you export, customize the appearance of the map.
        </p>
        <div className='grid grid-cols-2 gap-2'>
            <label>Hiding zone size:</label>
            <select value={zoneSize} onChange={handleZoneSizeChange} className='form-select'>
                <option value={ZoneSize.SmallMi}>¼ miles</option>
                <option value={ZoneSize.LargeMi}>½ miles</option>
                <option value={ZoneSize.SmallKm}>½ kilometers</option>
                <option value={ZoneSize.LargeKm}>1 kilometer</option>
            </select>
        </div>
        <h2>Export</h2>
        <p>
            When you are satisfied with the set of stations, click the button below to export them to a KML file.
            You can then import this file into your map app of choice.
        </p>
        <button className='btn btn-primary' onClick={saveToKml}>
            Export To KML
        </button>
    </div>;
}