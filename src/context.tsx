import { createContext, ReactNode, useEffect, useState } from 'react';
import { LatLngTuple } from 'leaflet';

import { getAsync } from './overpass_cache';
import { Id, pack } from './id';
import { Element, Relation, Way } from './element';
import { load, save } from './config';

type ContextContent = {
    boundaryIncluded: Set<Id>,
    setBoundaryIncluded: React.Dispatch<React.SetStateAction<Set<Id>>>,
    boundaryExcluded: Set<Id>,
    setBoundaryExcluded: React.Dispatch<React.SetStateAction<Set<Id>>>,
    notBoundaryExcluded: (id: Element | Id) => boolean,
    boundaryPath: LatLngTuple[] | undefined,
    setBoundaryPath: React.Dispatch<React.SetStateAction<LatLngTuple[] | undefined>>,
    boundaryEditing: boolean,
    setBoundaryEditing: React.Dispatch<React.SetStateAction<boolean>>,
    boundaryErrors: Set<Id>,
    setBoundaryErrors: React.Dispatch<React.SetStateAction<Set<Id>>>,

    showStations: boolean,
    setShowStations: React.Dispatch<React.SetStateAction<boolean>>,
    busRouteThreshold: number,
    setBusRouteThreshold: React.Dispatch<React.SetStateAction<number>>,
    trainRouteThreshold: number,
    setTrainRouteThreshold: React.Dispatch<React.SetStateAction<number>>,

    hovering: Id,
    setHovering: (n: Id) => void,

    save: () => void,
};

const config = load();
const dummyContent: ContextContent = {
    boundaryIncluded: config.boundary.included,
    setBoundaryIncluded: () => {},
    boundaryExcluded: config.boundary.excluded,
    setBoundaryExcluded: () => {},
    notBoundaryExcluded: () => true,
    boundaryPath: undefined,
    setBoundaryPath: () => {},
    boundaryEditing: false,
    setBoundaryEditing: () => {},
    boundaryErrors: new Set(),
    setBoundaryErrors: () => {},

    showStations: config.stations.show,
    setShowStations: () => {},
    busRouteThreshold: 2,
    setBusRouteThreshold: () => {},
    trainRouteThreshold: 1,
    setTrainRouteThreshold: () => {},
    

    hovering: '',
    setHovering: () => {},
    save: () => {},
};

export const Context = createContext(dummyContent);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [boundaryIncluded, setBoundaryIncluded] = useState(config.boundary.included);
    const [boundaryExcluded, setBoundaryExcluded] = useState(config.boundary.excluded);
    const [boundaryPath, setBoundaryPath] = useState(undefined as LatLngTuple[] | undefined);
    const [boundaryEditing, setBoundaryEditing] = useState(config.boundary.included.size === 0);
    const [boundaryErrors, setBoundaryErrors] = useState(new Set<Id>());

    const [showStations, setShowStations] = useState(config.stations.show);
    const [busRouteThreshold, setBusRouteThreshold] = useState(config.stations.busRouteThreshold);
    const [trainRouteThreshold, setTrainRouteThreshold] = useState(config.stations.trainRouteThreshold);
    const [refreshInProgress, setRefreshInProgress] = useState(false);

    const [hovering, setHovering] = useState('');
    
    function notBoundaryExcluded(id: Element | Id) {
        return !boundaryExcluded.has(typeof(id) === 'string' ? id : id.id);
    }

    const context: ContextContent = {
        boundaryIncluded, setBoundaryIncluded,
        boundaryExcluded, setBoundaryExcluded,
        notBoundaryExcluded,
        boundaryPath, setBoundaryPath,
        boundaryEditing, setBoundaryEditing,
        boundaryErrors, setBoundaryErrors,

        showStations, setShowStations,
        busRouteThreshold, setBusRouteThreshold,
        trainRouteThreshold, setTrainRouteThreshold,

        hovering, setHovering,
        save: () => {
            const newInclude = new Set(boundaryIncluded);
            const newExclude = new Set(boundaryExcluded);
            let updated = false;
            for (const id of boundaryIncluded) {
                if (boundaryExcluded.has(id)) {
                    updated = true;
                    newInclude.delete(id);
                    newExclude.delete(id);
                }
            }

            if (updated) {
                setBoundaryIncluded(newInclude);
                setBoundaryExcluded(newExclude);
            }

            save({
                boundary: {
                    included: newInclude,
                    excluded: newExclude,
                },
                stations: {
                    show: showStations,
                    busRouteThreshold,
                    trainRouteThreshold,
                },
            });
        },
    };

    useEffect(() => {
        async function helper() {
            if (refreshInProgress) { return; }

            console.log('Fetching boundaries');
            setRefreshInProgress(true);

            const relIds = [...boundaryIncluded].filter(notBoundaryExcluded);
            const relations = await getAsync(relIds, { request: true }) as Relation[];

            const wayIds = relations
                .flatMap(r => r.data.members)
                .map(m => ({ type: m.type, id: m.ref }))
                .filter(id => id.type === 'way')
                .map(id => pack(id))
                .filter(notBoundaryExcluded);
            const ways = (await getAsync(wayIds, { request: true })) as Way[];

            const nodeIds = ways
                .filter(notBoundaryExcluded)
                .flatMap(w => w.childIds);
            await getAsync(nodeIds, { request: true });

            setRefreshInProgress(false);
        }

        helper();

    }, [notBoundaryExcluded, boundaryIncluded, boundaryExcluded]);

    return <Context.Provider value={context}>
        {children}
    </Context.Provider>;
}