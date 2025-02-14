import { createContext, ReactNode, useEffect, useState } from 'react';
import { LatLngTuple } from 'leaflet';
import {  getAsync } from './overpass_api';

type Content = {
    included: number[],
    setIncluded: (n: number[]) => void,
    excluded: number[],
    setExcluded: (n: number[]) => void,

    editingBoundary: boolean,
    setEditingBoundary: (b: boolean) => void,
    boundaryReady: boolean,
    setBoundaryReady: (b: boolean) => void,
    boundary: LatLngTuple[],
    setBoundary: (b: LatLngTuple[]) => void,

    hovering: number,
    setHovering: (n: number) => void,

    save: () => void,
};

const dummyContent: Content = {
    included: [],
    setIncluded: () => {},
    excluded: [],
    setExcluded: () => {},

    editingBoundary: false,
    setEditingBoundary: () => {},
    boundaryReady: false,
    setBoundaryReady: () => {},
    boundary: [],
    setBoundary: () => {},

    hovering: 0,
    setHovering: () => {},

    save: () => {},
};

export const Context = createContext(dummyContent as Content);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [included, setIncluded] = useState(
        JSON.parse(window.localStorage.getItem('boundary_included') ?? '[]') as number[]);
    const [excluded, setExcluded] = useState(
        JSON.parse(window.localStorage.getItem('boundary_excluded') ?? '[]') as number[]);
    const [editingBoundary, setEditingBoundary] = useState(false);
    const [boundaryReady, setBoundaryReady] = useState(false);
    const [boundary, setBoundary] = useState([] as LatLngTuple[]);
    const [hovering, setHovering] = useState(0);

    useEffect(() => {
        async function helper() {
            setBoundaryReady(false);

            const relations = await getAsync('relation', included.filter(id => !excluded.includes(id)));

            const wayIds = relations.flatMap(r => 
                r.data.members
                    .filter(m => m.type === 'way')
                    .map(m => m.ref)
            );
            const ways = await getAsync('way', wayIds);

            const nodeIds = ways
                .filter(w => !excluded.includes(w.id))
                .flatMap(w => w.data.nodes);
            await getAsync('node', nodeIds);

            setBoundaryReady(true);
        }

        helper();

    }, [included, excluded]);

    function save() {
        let i = included;
        let e = excluded;
        for (const eid of e) {
            if (i.includes(eid)) {
                i = i.filter(id => id !== eid);
                e = e.filter(id => id !== eid);
            }
        }
        setIncluded(i);
        setExcluded(e);

        localStorage.setItem('boundary_included', JSON.stringify(i));
        localStorage.setItem('boundary_excluded', JSON.stringify(e));
    }

    const values = {
        included, setIncluded,
        excluded, setExcluded,
        editingBoundary, setEditingBoundary,
        boundaryReady, setBoundaryReady,
        boundary, setBoundary,
        hovering, setHovering,
        save, };
    return <Context.Provider value={values}>
        {children}
    </Context.Provider>;
}