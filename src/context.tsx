import { createContext, ReactNode, useState } from 'react';

type Content = {
    hovering: number,
    setHovering: (n: number) => void,
    included: number[],
    setIncluded: (n: number[]) => void,
    excluded: number[],
    setExcluded: (n: number[]) => void,

    save: () => void,
};

const dummyContent: Content = {
    hovering: 0,
    setHovering: () => {},
    included: [],
    setIncluded: () => {},
    excluded: [],
    setExcluded: () => {},

    save: () => {},
};

export const Context = createContext(dummyContent as Content);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [hovering, setHovering] = useState(0);
    const [included, setIncluded] = useState(
        JSON.parse(window.localStorage.getItem('boundary_included') ?? '[]') as number[]);
    const [excluded, setExcluded] = useState(
        JSON.parse(window.localStorage.getItem('boundary_excluded') ?? '[]') as number[]);

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

        localStorage.setItem('boundary_included', JSON.stringify(included));
        localStorage.setItem('boundary_excluded', JSON.stringify(excluded));
    }

    return <Context.Provider value={
        { hovering, setHovering, included, setIncluded, excluded, setExcluded, save }}>
        {children}
    </Context.Provider>;
}