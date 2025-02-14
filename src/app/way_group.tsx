import { JSX, useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Way as OsmWay, getWay } from './overpass_api';
import { TreeNode } from './tree_node';
import { Way } from './way';
import { onHover, onUnhover } from './hover_handler';

type Props = {
    id: number,
    inheritEnabled: boolean,
};

export function WayGroup({ id, inheritEnabled }: Props): JSX.Element {
    const map = useMap();
    const [way, setWay] = useState(undefined as OsmWay | undefined);
    const [enabled, setEnabled] = useState(true);

    useEffect(() => {
        async function go() {
            if (!map) {
                return;
            }
    
            // query for way path
            let w = way;
            if (!w || w.id !== id) {
                w = await getWay(id);
                setWay(w);
            }
        }
        
        go();
    }, [id, map]);

    function genLabel() {
        if (way) {
            return <label>
                <input type='checkbox' disabled={!inheritEnabled}
                    checked={enabled} onChange={e => setEnabled(e.target.checked)} />
                &nbsp;
                {way.name} (wg:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${way.id}`}>{way.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    return <TreeNode id={'g'+id.toString()} initiallyOpen={false}
        onMouseEnter={onHover(map, way?.following.map(w => w.id))}
        onMouseLeave={onUnhover(map, way?.following.map(w => w.id))}>
        { genLabel() }
        { way?.following.map(w => <Way key={w.id} id={w.id} inheritEnabled={inheritEnabled && enabled} />) }
    </TreeNode>;
}