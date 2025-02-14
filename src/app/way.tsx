import { JSX, ReactNode, useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Way as OsmWay, getWay } from './overpass_api';
import { TreeNode } from './tree_node';
import { onHover, onUnhover } from './hover_handler';

type Props = {
    id: number,
    inheritEnabled: boolean,
};

export function Way({ id, inheritEnabled }: Props): ReactNode{
    const map = useMap();
    const [way, setWay] = useState(undefined as OsmWay | undefined);
    const [enabled, setEnabled] = useState(true);
    const [feature, setFeature] = useState(undefined as google.maps.Data.Feature | undefined);

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

            let f = feature;
            if (!f) {
                setFeature(f = map.data.add(new google.maps.Data.Feature({ id: w?.id, properties: { enabled } })));
            } else if (f.getId() !== id) {
                map.data.remove(f);
                setFeature(f = map.data.add(new google.maps.Data.Feature({ id: w?.id, properties: { enabled } })));
            }

            f.setGeometry(new google.maps.Data.LineString(
                w.nodes.map(n => {
                    return { lat: n.lat, lng: n.lon } as google.maps.LatLngLiteral;
                })
            ));
        }
        
        go();
    }, [id, map]);

    useEffect(() => {
        if (!feature) { return; }
        feature.setProperty('enabled', inheritEnabled && enabled);
    }, [inheritEnabled, enabled]);

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

    return way && <TreeNode id={way.id.toString()} initiallyOpen={true}
        onMouseEnter={onHover(map, [way.id])} onMouseLeave={onUnhover(map, [way.id])}>
        { genLabel() }
    </TreeNode>;
}