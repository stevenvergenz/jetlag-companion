import { JSX, ReactNode, useEffect, useState } from 'react';
import { useMap } from 'react-leaflet';
import { Polyline } from 'leaflet';

import { Way as OsmWay, getWay } from './overpass_api';
import { TreeNode } from './tree_node';
import { onHover, onUnhover } from './hover_handler';

type Props = {
    id: number,
    inheritEnabled: boolean,
};

export function Way({ id, inheritEnabled }: Props): ReactNode{
    //const map = useMap();
    const [way, setWay] = useState(undefined as OsmWay | undefined);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        async function go() {
            // query for way path
            let w = way;
            if (!w || w.id !== id) {
                w = await getWay(id);
                setWay(w);
            }
        }
        
        go();
    }, [id]);

    function genLabel() {
        if (way) {
            return <label>
                <input type='checkbox' disabled={!inheritEnabled}
                    checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {way.name} (w:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${way.id}`}>{way.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    return way && <TreeNode id={way.id.toString()} initiallyOpen={true}>
        { genLabel() }
    </TreeNode>;
}