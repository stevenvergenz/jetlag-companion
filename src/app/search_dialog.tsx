import { ChangeEvent, JSX, useEffect, useState } from 'react';
import { RoadSearchResults, search_road } from './overpass_api';
import './search_dialog.css';

type Props = {
    visible: boolean,
    close: () => void,
};

export default function SearchDialog({ visible, close }: Props): JSX.Element {
    const [searchResult, setSearchResult] = useState(new Map() as RoadSearchResults);
    const [id, setId] = useState(undefined as number | undefined);
    const [role, setRole] = useState(undefined as string | undefined);

    useEffect(() => {
        if (!visible) {
            setSearchResult(new Map());
            setId(undefined);
            setRole(undefined);
        }
    }, [visible]);

    async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const data = new FormData(e.target as HTMLFormElement);
        const text = data.get('searchText') as string;
        if (!text) {
            alert('No search text');
        }
        const res = await search_road(text);
        setSearchResult(res);
        for (const first_id of res.keys()) {
            setId(first_id);
            setRole(res.get(first_id)?.member_roles[0]);
            break;
        }
    }

    function onIdChange(e: ChangeEvent<HTMLSelectElement>) {
        const id = parseInt(e.target.value, 10);
        setId(id);
        setRole(searchResult.get(id)?.member_roles[0]);
    }

    const display = !visible ? 'hidden' : '';
    return <div className={
        'absolute top-10 w-4/5 h-400px ' +
        'bg p-4 gap-2 flex flex-col content-stretch ' +
        display }>
        <p>Search for a road by description</p>
        <form onSubmit={onSubmit} className='flex gap-4'>
            <input name='searchText' type='text' className='p-1 text-black' />
            <button type='submit'>&#x1F50D;</button>
        </form>

        <p>
            { searchResult.size > 1 ? 'Multiple results found, choose from the list below.' :
                searchResult.size > 0 ? 'One result found.' :
                'No results.' }
        </p>

        <select value={id} onChange={onIdChange}
            className={searchResult.size === 0 ? 'hidden' : ''}>
            {searchResult?.values().map(r => <option key={r.id} value={r.id}>{r.description}</option>)}
        </select>

        <select value={role} onChange={(e) => setRole(e.target.value)}
            className={searchResult.size === 0 ? 'hidden' : ''}>
            {id && searchResult?.get(id)?.member_roles.map(r => <option key={r}>{r}</option>)}
        </select>

        <button onClick={close} className={'absolute top-0 right-0 m-4 border-solid'}>
            X
        </button>
    </div>;
}