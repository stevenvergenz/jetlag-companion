import { createContext, ReactNode, useContext, useState } from 'react';

type Content = {
    hovering: number,
    setHovering: (n: number) => void,
    included: number[],
    setIncluded: (n: number[]) => void,
    excluded: number[],
    setExcluded: (n: number[]) => void,
};

const dummyContent: Content = {
    hovering: 0,
    setHovering: () => {},
    included: [],
    setIncluded: () => {},
    excluded: [],
    setExcluded: () => {},
};

export const Context = createContext(dummyContent as Content);

export function ContextProvider({ children }: { children: ReactNode }) {
    const [hovering, setHovering] = useState(0);
    const [included, setIncluded] = useState([380107, 149149, 380109] as number[]);
    const [excluded, setExcluded] = useState([] as number[]);

    return <Context.Provider value={{ hovering, setHovering, included, setIncluded, excluded, setExcluded }}>
        {children}
    </Context.Provider>;
}