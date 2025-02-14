import { Dispatch, JSX, SetStateAction } from 'react';

type Props = {
    toggleSearchVisible: () => void,
}

export default function TopBar({ toggleSearchVisible }: Props): JSX.Element {
    return <header className='m-2 flex gap-4'>
        <span>Jet Lag Companion</span>
        <button onClick={toggleSearchVisible}>&#x1F50D;</button>
    </header>;
}