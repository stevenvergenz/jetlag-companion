import { ChangeEvent, JSX, useEffect, useRef, useState, Ref, RefObject } from 'react';
import { getRelation, OsmRelation } from './overpass_api';
import { Boundary } from './boundaries';
import './search_dialog.css';

type Props = {
    visible: boolean,
    close: () => void,
    boundaries: Boundary[],
    setBoundaries: (boundaries: Boundary[]) => void,
};

export default function SearchDialog({ visible, close, boundaries, setBoundaries }: Props): JSX.Element {
    const [id, setId] = useState(undefined as number | undefined);

    useEffect(() => {
        if (!visible) {
            setId(undefined);
        }
    }, [visible]);

    async function onSearch(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();

        const data = new FormData(e.target as HTMLFormElement);
        const text = data.get('searchText') as string;
        if (!text) {
            alert('No search text');
        }
        const res = await getRelation(parseInt(text, 10));
        setId(res?.id);
    }

    function onIdChange(e: ChangeEvent<HTMLSelectElement>) {
        const id = parseInt(e.target.value, 10);
        setId(id);
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
            {searchResult.map(r =>
                <option key={r.id} value={r.id}>
                    {r.tags?.['description'] ?? r.tags?.['name'] ?? r.tags?.['ref'] ?? '<unspecified>'}
                </option>
            )}
        </select>

        <button onClick={onAdd}>Add</button>
    </div>;
}