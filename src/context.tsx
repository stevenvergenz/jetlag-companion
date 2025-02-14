import { createContext, ReactNode, useEffect, useState } from 'react';
import { LatLngTuple } from 'leaflet';

import { fetchAsync } from './overpass_api';
import { Id, pack } from './id';
import { Element, Relation, Way } from './osm_element';
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
            const relations = (await fetchAsync([...included].filter(context.boundary.notExcluded))) as Relation[];

            const wayIds = relations
                .flatMap(r => r.data.members)
                .map(m => ({ type: m.type, id: m.ref }))
                .filter(id => id.type === 'way')
                .map(id => pack(id))
                .filter(context.boundary.notExcluded);
            const ways = (await fetchAsync(wayIds)) as Way[];

            const nodeIds = ways
                .filter(context.boundary.notExcluded)
                .flatMap(w => w.childIds);
            await fetchAsync(nodeIds);
        }

        helper();

    }, [context.boundary, included, excluded]);

    return <Context.Provider value={context}>
        {children}
    </Context.Provider>;
}