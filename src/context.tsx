import { createContext, ReactNode, useEffect, useState } from 'react';
import { LatLngTuple } from 'leaflet';
import { getAsync } from './overpass_api';
import { Id, pack } from './id';
import { Relation, Way } from './osm_element';

type Content = {
    included: Id[],
    setIncluded: (n: Id[]) => void,
    excluded: Id[],
    setExcluded: (n: Id[]) => void,

    editingBoundary: boolean,
    setEditingBoundary: (b: boolean) => void,
    boundaryReady: boolean,
    setBoundaryReady: (b: boolean) => void,
    boundary: LatLngTuple[],
    setBoundary: (b: LatLngTuple[]) => void,

    hovering: Id,
    setHovering: (n: Id) => void,

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

    hovering: '',
    setHovering: () => {},

    save: () => {},
};

export const Context = createContext(dummyContent as Content);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [included, setIncluded] = useState(
        JSON.parse(window.localStorage.getItem('boundary_included') ?? '[]')
        .map((id: number | string) => typeof(id) === 'number' ? pack({ type: 'relation', id }) : id) as Id[],
    );
    const [excluded, setExcluded] = useState(
        JSON.parse(window.localStorage.getItem('boundary_excluded') ?? '[]')
        .map((id: number | string) => typeof(id) === 'number' ? pack({ type: id < 0 ? 'wayGroup' : 'way', id }) : id) as Id[],
    );
    const [editingBoundary, setEditingBoundary] = useState(false);
    const [boundaryReady, setBoundaryReady] = useState(false);
    const [boundary, setBoundary] = useState([] as LatLngTuple[]);
    const [hovering, setHovering] = useState('');

    useEffect(() => {
        async function helper() {
            setBoundaryReady(false);

            const relations = (await getAsync(included.filter(id => !excluded.includes(id)))) as Relation[];

            const wayIds = relations
                .flatMap(r => r.data.members)
                .map(m => ({ type: m.type, id: m.ref }))
                .filter(id => id.type === 'way')
                .map(id => pack(id))
                .filter(id => !excluded.includes(id));
            const ways = (await getAsync(wayIds)) as Way[];

            const nodeIds = ways
                .filter(w => !excluded.includes(w.id))
                .flatMap(w => w.childIds);
            await getAsync(nodeIds);

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