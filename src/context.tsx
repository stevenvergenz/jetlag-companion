import { createContext, ReactNode, useState, useEffect } from 'react';
import { Position } from 'geojson';

import { Id, Station, Way, Node } from './data/index';
import { load, save, PartialConfig, apply, ZoneSize } from './config';
import { dbClear, memCacheId, getByTransportTypeAsync } from './util/overpass_cache';

export enum BoundaryEditMode {
    None,
    Init,
    Adjust,
}

type ContextContent = {
    boundaryPoints: Position[],
    boundaryEditing: BoundaryEditMode,
    setBoundaryEditing: React.Dispatch<React.SetStateAction<BoundaryEditMode>>,

    busRouteThreshold: number,
    trainRouteThreshold: number,
    stations: Station[],
    setStations: React.Dispatch<React.SetStateAction<Station[]>>,
    zoneSize: ZoneSize,

    hovering: Id,
    setHovering: (n: Id) => void,

    save: (config: PartialConfig) => void,
};

let config = load();
const dummyContent: ContextContent = {
    boundaryPoints: [],
    boundaryEditing: BoundaryEditMode.None,
    setBoundaryEditing: () => {},

    busRouteThreshold: 2,
    trainRouteThreshold: 1,
    stations: [],
    setStations: () => {},
    zoneSize: ZoneSize.SmallMi,

    hovering: '',
    setHovering: () => {},
    save: () => {},
};

export const SharedContext = createContext(dummyContent);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [boundaryPoints, setBoundaryPoints] = useState<Position[]>(config.boundary?.points ?? []);
    const [boundaryEditing, setBoundaryEditing] = useState(BoundaryEditMode.None);
    const [busRouteThreshold, setBusRouteThreshold] = useState(config.stations.busRouteThreshold);
    const [trainRouteThreshold, setTrainRouteThreshold] = useState(config.stations.trainRouteThreshold);
    const [hovering, setHovering] = useState('');
    const [stations, setStations] = useState<Station[]>([]);
    const [zoneSize, setZoneSize] = useState(config.stations.zoneSize);

    useEffect(() => {
        async function updateStations(): Promise<Station[]> {
            if (boundaryEditing !== BoundaryEditMode.None || boundaryPoints.length < 4) {
                return [];
            }

            const platforms = await getByTransportTypeAsync<Way | Node>(
                boundaryPoints, 
                'platform',
                { request: true },
            );
            console.log(`[station] ${platforms.length} platforms found`);

            const tempStations = platforms.flatMap(platform => {
                return platform.parentRefs.flatMap(pRef => {
                    return pRef.element instanceof Station && pRef.role === 'platform' ? [pRef.element as Station] : [];
                });
            });
            console.log(`[station] Found ${tempStations.length} existing stations`);

            for (const platform of platforms) {
                const matchingStations = tempStations.filter(s => s.tryAdd(platform));
                if (matchingStations.length === 0) {
                    const newStation = new Station(platform);
                    memCacheId.set(newStation.id, newStation);
                    tempStations.push(newStation);
                }
            }
            console.log(`[station] ${tempStations.length} stations found`);

            return tempStations;
        }
        
        let ignore = false;
        setStations([]);
        updateStations().then(s => {
            if (!ignore) {
                setStations(s);
            }
        });
        return () => { ignore = true; };
    }, [boundaryPoints, boundaryEditing]);

    const context: ContextContent = {
        boundaryPoints,
        boundaryEditing, setBoundaryEditing,

        busRouteThreshold,
        trainRouteThreshold,
        stations, setStations,
        zoneSize,

        hovering, setHovering,
        save: (update: PartialConfig) => {
            config = apply(config, update);
            save(config);

            if (update.boundary?.points !== undefined) {
                setBoundaryPoints(config.boundary.points);
                dbClear();
                memCacheId.clear();
            }
            if (update.stations?.busRouteThreshold !== undefined) {
                setBusRouteThreshold(config.stations.busRouteThreshold);
            }
            if (update.stations?.trainRouteThreshold !== undefined) {
                setTrainRouteThreshold(config.stations.trainRouteThreshold);
            }
            if (update.stations?.zoneSize !== undefined) {
                setZoneSize(config.stations.zoneSize);
            }
        },
    };

    return <SharedContext.Provider value={context}>
        {children}
    </SharedContext.Provider>;
}