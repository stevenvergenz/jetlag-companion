import { JSX, useEffect, useState } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Way as OsmWay, getWay } from './overpass_api';
import { TreeNode } from './tree_node';

type Props = {
    id: number,
    group?: boolean,
};

export function Way({ id, group }: Props): JSX.Element {
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

            if (group) {
                return;
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
                {way.name} ({group ? 'wg' : 'w'}:
                <a target='_blank' href={`https://www.openstreetmap.org/relation/${way.id}`}>{way.id}</a>
                )
            </label>;
        } else {
            return <label>&lt;loading&gt;</label>;
        }
    }

    function onHover() {
        
    }

    function onUnhover() {
        
    }

    function genGroup() {
        return <TreeNode id={'g'+id.toString()} initiallyOpen={false}>
            { genLabel() }
            { way?.following.map(w => <Way key={w.id} id={w.id} group={false} />) }
        </TreeNode>;
    }

    function genSolo() {
        return way && <TreeNode id={way.id.toString()} initiallyOpen={true}
            onMouseEnter={onHover} onMouseLeave={onUnhover}>
            { genLabel() }
        </TreeNode>;
    }

    return <>
        { group && genGroup() }
        { !group && genSolo()}
    </>;
}