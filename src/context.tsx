import { createContext, ReactNode, useState } from 'react';
import { LatLngTuple } from 'leaflet';

import { Id } from './id';
import { Element } from './element';
import { load, save, PartialConfig } from './config';
import StationGroup from './station_group';

type ContextContent = {
    boundaryIncluded: Set<Id>,
    //setBoundaryIncluded: React.Dispatch<React.SetStateAction<Set<Id>>>,
    boundaryExcluded: Set<Id>,
    //setBoundaryExcluded: React.Dispatch<React.SetStateAction<Set<Id>>>,
    //notBoundaryExcluded: (id: Element | Id) => boolean,
    boundaryPath: LatLngTuple[] | undefined,
    setBoundaryPath: React.Dispatch<React.SetStateAction<LatLngTuple[] | undefined>>,
    boundaryEditing: boolean,
    setBoundaryEditing: React.Dispatch<React.SetStateAction<boolean>>,
    boundaryErrors: Set<Id>,
    setBoundaryErrors: React.Dispatch<React.SetStateAction<Set<Id>>>,

    showStations: boolean,
    //setShowStations: React.Dispatch<React.SetStateAction<boolean>>,
    busRouteThreshold: number,
    //setBusRouteThreshold: React.Dispatch<React.SetStateAction<number>>,
    trainRouteThreshold: number,
    //setTrainRouteThreshold: React.Dispatch<React.SetStateAction<number>>,
    stations: StationGroup[],
    setStations: React.Dispatch<React.SetStateAction<StationGroup[]>>,

    hovering: Id,
    setHovering: (n: Id) => void,

    save: (config: PartialConfig) => void,
};

const config = load();
const dummyContent: ContextContent = {
    boundaryIncluded: config.boundary.included,
    //setBoundaryIncluded: () => {},
    boundaryExcluded: config.boundary.excluded,
    //setBoundaryExcluded: () => {},
    //notBoundaryExcluded: () => true,
    boundaryPath: undefined,
    setBoundaryPath: () => {},
    boundaryEditing: false,
    setBoundaryEditing: () => {},
    boundaryErrors: new Set(),
    setBoundaryErrors: () => {},

    showStations: config.stations.show,
    //setShowStations: () => {},
    busRouteThreshold: 2,
    //setBusRouteThreshold: () => {},
    trainRouteThreshold: 1,
    //setTrainRouteThreshold: () => {},
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
    const [boundaryIncluded, setBoundaryIncluded] = useState(config.boundary.included);
    const [boundaryExcluded, setBoundaryExcluded] = useState(config.boundary.excluded);
    const [boundaryPath, setBoundaryPath] = useState(undefined as LatLngTuple[] | undefined);
    const [boundaryEditing, setBoundaryEditing] = useState(false);
    const [boundaryErrors, setBoundaryErrors] = useState(new Set<Id>());

    const [showStations, setShowStations] = useState(config.stations.show);
    const [busRouteThreshold, setBusRouteThreshold] = useState(config.stations.busRouteThreshold);
    const [trainRouteThreshold, setTrainRouteThreshold] = useState(config.stations.trainRouteThreshold);
    const [stations, setStations] = useState([] as StationGroup[]);

    const [hovering, setHovering] = useState('');


    const context: ContextContent = {
        boundaryIncluded, //setBoundaryIncluded,
        boundaryExcluded, //setBoundaryExcluded,
        //notBoundaryExcluded,
        boundaryPath, setBoundaryPath,
        boundaryEditing, setBoundaryEditing,
        boundaryErrors, setBoundaryErrors,

        showStations, //setShowStations,
        busRouteThreshold, //setBusRouteThreshold,
        trainRouteThreshold, //setTrainRouteThreshold,
        stations, setStations,

        hovering, setHovering,
        save: (config: PartialConfig) => {
            if (config.boundary?.included ?? config.boundary?.excluded) {
                const newInclude = new Set(config.boundary?.included ?? boundaryIncluded);
                const newExclude = new Set(config.boundary?.excluded ?? boundaryExcluded);
    
                for (const id of newInclude) {
                    if (newExclude.has(id)) {
                        newInclude.delete(id);
                        newExclude.delete(id);
                    }
                }
    
                setBoundaryIncluded(newInclude);
                setBoundaryExcluded(newExclude);

                config.boundary.included = newInclude;
                config.boundary.excluded = newExclude;
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
                    included: config.boundary?.included ?? boundaryIncluded,
                    excluded: config.boundary?.excluded ?? boundaryExcluded,
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