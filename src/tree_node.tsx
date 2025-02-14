import { JSX, useState, ReactNode, MouseEventHandler, MouseEvent } from 'react';

type Props = {
    id: string,
    children: ReactNode,
    initiallyOpen: boolean,
    onMouseEnter?: MouseEventHandler,
    onMouseLeave?: MouseEventHandler,
}

export function TreeNode({ id, children, initiallyOpen, onMouseEnter, onMouseLeave }: Props): JSX.Element {
    const [open, setOpen] = useState(initiallyOpen);
    const [hover, setHover] = useState(false);
    function toggle() {
        setOpen(!open);
    }

    function mouseEnter(e: MouseEvent<Element>) {
        setHover(true);
        if (onMouseEnter) {
            onMouseEnter(e);
        }
    }

    function mouseLeave(e: MouseEvent<Element>) {
        setHover(false);
        if (onMouseLeave) {
            onMouseLeave(e);
        }
    }

    return <div className={hover ? 'bg-sky-100' : ''}>
        <div onMouseEnter={onMouseEnter && mouseEnter} onMouseLeave={onMouseLeave && mouseLeave}>
            <button type='button' onClick={toggle}>
                { !Array.isArray(children) ? '•' : open ? '⮟' : '⮞' }
            </button>
            &nbsp;
            {Array.isArray(children) ? children[0] : children}
        </div>
        { open && <ol className='ps-4'>
            {Array.isArray(children) &&
                children.slice(1).map((c, i) => <li key={`${id}-${i}`}>{c}</li>)}
        </ol>}
    </div>;
}