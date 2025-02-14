import { ChangeEvent, JSX, useEffect, useRef, useState, Ref, RefObject } from 'react';
import { member_roles, OsmRelation, search_road } from './overpass_api';
import { Boundary } from './boundaries';
import './search_dialog.css';

type Props = {
    visible: boolean,
    close: () => void,
    boundaries: Boundary[],
    setBoundaries: (boundaries: Boundary[]) => void,
};

export default function SearchDialog({ visible, close, boundaries, setBoundaries }: Props): JSX.Element {
    const [searchResult, setSearchResult] = useState([] as OsmRelation[]);
    const [idMap, setIdMap] = useState(new Map() as Map<number, OsmRelation>);
    const [id, setId] = useState(undefined as number | undefined);
    const [role, setRole] = useState("");

    useEffect(() => {
        if (!visible) {
            setSearchResult([]);
            setIdMap(new Map());
            setId(undefined);
            setRole("");
        }
    }, [visible]);

    useEffect(() => {
        setIdMap(searchResult.reduce((map, r) => {
            map.set(r.id, r);
            return map;
        }, new Map()));
    }, [searchResult]);

    async function onSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const data = new FormData(e.target as HTMLFormElement);
        const text = data.get('searchText') as string;
        if (!text) {
            alert('No search text');
        }
        const res = await search_road(text);
        setSearchResult(res);
        for (const first of res) {
            setId(first.id);
            setRole(member_roles(first)[0]);
            break;
        }
    }

    function onIdChange(e: ChangeEvent<HTMLSelectElement>) {
        const id = parseInt(e.target.value, 10);
        setId(id);
        setRole(member_roles(idMap.get(id))[0]);
    }

    function onAdd() {
        if (!id) {
            console.error('No id, cannot add');
            return;
        }

        const result = idMap.get(id);

        let newBoundaries = [...boundaries, {
            id: id,
            title: result?.tags?.['description'] ?? '<unspecified>',
            member_role: role,
        } as Boundary];
        setBoundaries(newBoundaries);
    }

    return <div className={
        'w-30 max-w-md ' +
        'bg p-4 gap-2 flex flex-col content-stretch'}>
        <ul>
            {boundaries.length === 0 && <li><i>No boundary roads selected.</i></li>}
            {boundaries.map(b => {
                return <li key={b.id}>
                    <a target='_blank' href={`https://www.openstreetmap.org/relation/${b.id}`}>{b.title} ({b.id})</a>
                </li>;
            })}
        </ul>
        <hr />
        <p>Search for a road by description</p>
        <form onSubmit={onSearch} className='flex gap-4'>
            <input name='searchText' type='text' className='p-1 text-black' />
            <button type='submit'>&#x1F50D;</button>
        </form>

        <p>{
            searchResult.length > 1 ? 'Multiple results found, choose from the list below.' :
            searchResult.length > 0 ? 'One result found.' :
            'No results.'
        }</p>

        <select value={id} onChange={onIdChange}
            className={searchResult.length === 0 ? 'hidden' : ''}>
            {searchResult.map(r => <option key={r.id} value={r.id}>{r.tags?.['description']}</option>)}
        </select>

        <select value={role} onChange={e => setRole(e.target.value)}>
            {id && member_roles(idMap.get(id)).map((r, i) => {
                return <option key={r}>{r.length > 0 ? r : '<unspecified>'}</option>;
            })}
        </select>
        <button onClick={onAdd}>Add</button>
    </div>;
}