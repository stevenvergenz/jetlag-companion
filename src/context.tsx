import React, { createContext, ReactNode, useState } from 'react';
import { Position } from 'geojson';

import { Id, Element, Station } from './data/index';
import { load, save, PartialConfig } from './config';

type ContextContent = {
    boundaryPoints: Position[],
    //setBoundaryPoints: React.Dispatch<React.SetStateAction<Position[]>>,
    boundaryEditing: boolean,
    setBoundaryEditing: React.Dispatch<React.SetStateAction<boolean>>,
    boundaryErrors: Set<Id>,
    setBoundaryErrors: React.Dispatch<React.SetStateAction<Set<Id>>>,

    showStations: boolean,
    busRouteThreshold: number,
    trainRouteThreshold: number,
    stations: Station[],
    setStations: React.Dispatch<React.SetStateAction<Station[]>>,

    hovering: Id,
    setHovering: (n: Id) => void,

    save: (config: PartialConfig) => void,
};

const config = load();
const dummyContent: ContextContent = {
    boundaryPoints: [],
    //setBoundaryPoints: () => {},
    boundaryEditing: false,
    setBoundaryEditing: () => {},
    boundaryErrors: new Set(),
    setBoundaryErrors: () => {},

    showStations: config.stations.show,
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
    const [boundaryErrors, setBoundaryErrors] = useState(new Set<Id>());

    const [showStations, setShowStations] = useState(config.stations.show);
    const [busRouteThreshold, setBusRouteThreshold] = useState(config.stations.busRouteThreshold);
    const [trainRouteThreshold, setTrainRouteThreshold] = useState(config.stations.trainRouteThreshold);
    const [stations, setStations] = useState([] as Station[]);

    const [hovering, setHovering] = useState('');

    const context: ContextContent = {
        boundaryPoints, //setBoundaryPoints,
        boundaryEditing, setBoundaryEditing,
        boundaryErrors, setBoundaryErrors,

        showStations,
        busRouteThreshold,
        trainRouteThreshold,
        stations, setStations,

        hovering, setHovering,
        save: (config: PartialConfig) => {
            if (config.boundary?.points !== undefined) {
                setBoundaryPoints(config.boundary.points);
            }
            if (config.stations?.show !== undefined) {
                setShowStations(config.stations.show);
            }
            if (config.stations?.busRouteThreshold !== undefined) {
                setBusRouteThreshold(config.stations.busRouteThreshold);
            }
            if (config.stations?.trainRouteThreshold !== undefined) {
                setTrainRouteThreshold(config.stations.trainRouteThreshold);
            }

            save({
                boundary: {
                    points: config.boundary?.points ?? [],
                },
                stations: {
                    show: showStations,
                    busRouteThreshold,
                    trainRouteThreshold,
                    ...config.stations,
                },
            });
        },
    };

    return <SharedContext.Provider value={context}>
        {children}
    </SharedContext.Provider>;
}