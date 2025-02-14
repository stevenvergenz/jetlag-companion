import { JSX, ReactNode, useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Way as OsmWay, getWay } from './overpass_api';
import { TreeNode } from './tree_node';
import { onHover, onUnhover } from './hover_handler';

type Props = {
    id: number,
};

export function Way({ id }: Props): ReactNode{
    const map = useMap();
    const [way, setWay] = useState(undefined as OsmWay | undefined);
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
                setFeature(f = map.data.add(new google.maps.Data.Feature({ id: w?.id })));
            } else if (f.getId() !== id) {
                map.data.remove(f);
                setFeature(f = map.data.add(new google.maps.Data.Feature({ id: w?.id })));
            }

            f.setGeometry(new google.maps.Data.LineString(
                w.nodes.map(n => {
                    return { lat: n.lat, lng: n.lon } as google.maps.LatLngLiteral;
                })
            ));
        }
        
        go();
    }, [id, map]);

    function genLabel() {
        if (way) {
            return <label>
                <input type='checkbox' />
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