import { createContext, ReactNode, useEffect, useState } from 'react';
import { LatLngTuple } from 'leaflet';

import { requestAsync } from './overpass_api';
import { Id, pack } from './id';
import { Element, Relation, Way } from './element';
import { load, save } from './config';

type ContextContent = {
    boundary: {
        included: Set<Id>,
        setIncluded: React.Dispatch<React.SetStateAction<Set<Id>>>,
        excluded: Set<Id>,
        setExcluded: React.Dispatch<React.SetStateAction<Set<Id>>>,
        notExcluded: (id: Element | Id) => boolean,
        path: LatLngTuple[] | undefined,
        setPath: React.Dispatch<React.SetStateAction<LatLngTuple[] | undefined>>,
        editing: boolean,
        setEditing: React.Dispatch<React.SetStateAction<boolean>>,
        errors: Set<Id>,
        setErrors: React.Dispatch<React.SetStateAction<Set<Id>>>,
    },

    stations: {
        show: boolean,
        setShow: React.Dispatch<React.SetStateAction<boolean>>,
        useTransitStations: boolean,
        setUseTransitStations: React.Dispatch<React.SetStateAction<boolean>>,
        busTransferThreshold: number,
        setBusTransferThreshold: React.Dispatch<React.SetStateAction<number>>,
    },

    hovering: Id,
    setHovering: (n: Id) => void,

    save: () => void,
};

const config = load();
const dummyContent: ContextContent = {
    boundary: {
        included: config.boundary.included,
        setIncluded: () => {},
        excluded: config.boundary.excluded,
        setExcluded: () => {},
        notExcluded: () => true,
        path: undefined,
        setPath: () => {},
        editing: false,
        setEditing: () => {},
        errors: new Set(),
        setErrors: () => {},
    },
    stations: {
        show: config.stations.show,
        setShow: () => {},
        useTransitStations: config.stations.useTransitStations,
        setUseTransitStations: () => {},
        busTransferThreshold: 2,
        setBusTransferThreshold: () => {},
    },

    hovering: '',
    setHovering: () => {},
    save: () => {},
};

export const Context = createContext(dummyContent);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [included, setIncluded] = useState(config.boundary.included);
    const [excluded, setExcluded] = useState(config.boundary.excluded);
    const [editingBoundary, setEditingBoundary] = useState(false);
    const [boundary, setBoundary] = useState(undefined as LatLngTuple[] | undefined);
    const [hovering, setHovering] = useState('');
    const [boundaryErrors, setBoundaryErrors] = useState(new Set<Id>());
    const [showStations, setShowStations] = useState(true);
    const [useTransitStations, setUseTransitStations] = useState(true);
    const [busTransferThreshold, setBusTransferThreshold] = useState(2);

    const context: ContextContent = {
        boundary: {
            included, setIncluded,
            excluded, setExcluded,
            notExcluded: (id: Element | Id) => !excluded.has(typeof(id) === 'string' ? id : id.id),
            path: boundary, setPath: setBoundary,
            editing: editingBoundary, setEditing: setEditingBoundary,
            errors: boundaryErrors, setErrors: setBoundaryErrors,
        },
        stations: {
            show: showStations, setShow: setShowStations,
            useTransitStations, setUseTransitStations,
            busTransferThreshold, setBusTransferThreshold,
        }, 

        hovering, setHovering,
        save: () => {
            save({
                boundary: {
                    included, excluded,
                },
                stations: {
                    show: showStations,
                    useTransitStations,
                },
            });
        },
    };

    useEffect(() => {
        async function helper() {
            const relIds = [...included].filter(context.boundary.notExcluded);
            const relations = await requestAsync(...relIds) as Relation[];

            const wayIds = relations
                .flatMap(r => r.data.members)
                .map(m => ({ type: m.type, id: m.ref }))
                .filter(id => id.type === 'way')
                .map(id => pack(id))
                .filter(context.boundary.notExcluded);
            const ways = (await requestAsync(...wayIds)) as Way[];

            const nodeIds = ways
                .filter(context.boundary.notExcluded)
                .flatMap(w => w.childIds);
            await requestAsync(...nodeIds);
        }

        helper();

    }, [context.boundary, included, excluded]);

    return <Context.Provider value={context}>
        {children}
    </Context.Provider>;
}