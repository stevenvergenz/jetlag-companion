import React, { createContext, ReactNode, useState } from 'react';
import { Position } from 'geojson';

import { Id, Element, Station } from './data/index';
import { load, save, PartialConfig, apply } from './config';
import { dbClear, memCacheId } from './util/overpass_cache';

type ContextContent = {
    boundaryPoints: Position[],
    //setBoundaryPoints: React.Dispatch<React.SetStateAction<Position[]>>,
    boundaryEditing: boolean,
    setBoundaryEditing: React.Dispatch<React.SetStateAction<boolean>>,

    busRouteThreshold: number,
    trainRouteThreshold: number,
    stations: Station[],
    setStations: React.Dispatch<React.SetStateAction<Station[]>>,

    hovering: Id,
    setHovering: (n: Id) => void,

    save: (config: PartialConfig) => void,
};

let config = load();
const dummyContent: ContextContent = {
    boundaryPoints: [],
    //setBoundaryPoints: () => {},
    boundaryEditing: false,
    setBoundaryEditing: () => {},

    busRouteThreshold: 2,
    trainRouteThreshold: 1,
    stations: [],
    setStations: () => {},

    hovering: '',
    setHovering: () => {},
    save: () => {},
};

export function notExcluded(excluded: Set<Id>) {
    return (id: Element | Id) => {
        return !excluded.has(typeof(id) === 'string' ? id : id.id);
    };
}

export const SharedContext = createContext(dummyContent);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [boundaryPoints, setBoundaryPoints] = useState<Position[]>(config.boundary?.points ?? []);
    const [boundaryEditing, setBoundaryEditing] = useState(false);

    const [busRouteThreshold, setBusRouteThreshold] = useState(config.stations.busRouteThreshold);
    const [trainRouteThreshold, setTrainRouteThreshold] = useState(config.stations.trainRouteThreshold);
    const [stations, setStations] = useState([] as Station[]);

    const [hovering, setHovering] = useState('');

    const context: ContextContent = {
        boundaryPoints, //setBoundaryPoints,
        boundaryEditing, setBoundaryEditing,

        busRouteThreshold,
        trainRouteThreshold,
        stations, setStations,

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
        },
    };

    return <SharedContext.Provider value={context}>
        {children}
    </SharedContext.Provider>;
}