import { JSX } from 'react';

export function TopBar(): JSX.Element {
    return <header className='p-2 flex gap-4 border-b'>
        <span>Jet Lag Companion</span>
    </header>;
}