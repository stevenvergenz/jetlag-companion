import { JSX, useState, ReactNode, MouseEventHandler } from 'react';

type Props = {
    id: string,
    children: ReactNode,
    initiallyOpen: boolean,
    onMouseEnter?: MouseEventHandler,
    onMouseLeave?: MouseEventHandler,
}

export function TreeNode({ id, children, initiallyOpen, onMouseEnter, onMouseLeave }: Props): JSX.Element {
    const [open, setOpen] = useState(initiallyOpen);

    function toggle() {
        setOpen(!open);
    }

    return <div onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
        <div>
            <button type='button' onClick={toggle}>
                { !Array.isArray(children) ? '•' : open ? '⮟' : '⮞' }
                &nbsp;
                {Array.isArray(children) ? children[0] : children}
            </button>
        </div>
        <ol className={`ps-2 ${open ? '' : 'hidden'}`}>
            {Array.isArray(children) &&
                children.slice(1).map((c, i) => <li key={`${id}-${i}`}>{c}</li>)}
        </ol>
    </div>;
}