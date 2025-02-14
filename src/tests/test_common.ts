import { LatLngTuple } from 'leaflet';
import { Relation, Way, Node, WayGroup } from '../osm_element';
import { cache } from '../overpass_api';
import { pack } from '../id';


/**
 * ```text
 *                                    |          |       
 *       n1         n2                w1        w2       
 *                                    |          |       
 *  n3   n4    n5   n6    n7    --w3--+----w4----+--w5-- 
 *                                    |          |       
 *       n8         n9                w6        w7      
 *                                    |          |      
 * n10  n11   n12   n13   n14   --w8--+----w9----+--w10- 
 *                                    |          |     
 *      n15         n16             w11        w12 
 *                                    |          |   
 * ```
 */
export function setup(): void {
    cache.clear();
    WayGroup.reset();

    layout([    1,    2   ], [-1,  2], [2, 0]);
    layout([ 3, 4, 5, 6, 7], [-2,  1], [1, 0]);
    layout([    8,    9   ], [-1,  0], [2, 0]);
    layout([10,11,12,13,14], [-2, -1], [1, 0]);
    layout([   15,   16   ], [-1, -2], [2, 0]);

    way(1, [1, 4]); way(2, [2, 6]);
    way(3, [3, 4]); way(4, [4, 5, 6]); way(5, [6, 7]);
    way(6, [4, 8, 11]); way(7, [6, 9, 13]);
    way(8, [10, 11]); way(9, [11, 12, 13]); way(10, [13, 14]);
    way(11, [11, 15]); way(12, [13, 16]);

    way(100, [4, 1]); way(200, [6, 2]);
    way(300, [4, 3]); way(400, [6, 5, 4]); way(500, [7, 6]);
    way(600, [11, 8, 4]); way(700, [13, 9, 6]);
    way(800, [11, 10]); way(900, [13, 12, 11]); way(1000, [14, 13]);
    way(1100, [15, 11]); way(1200, [16, 13]);

    function layout(ids: number[], start: LatLngTuple, offset: LatLngTuple): Node[] {
        return ids.map((id, i) => node(id, start[0] + offset[0] * i, start[1] + offset[1] * i));
    }
}

export function relation(id: number, members: number[]): Relation {
    const r = new Relation(pack({ type: 'relation', id }), {
        type: 'relation',
        id,
        members: members.map(id => ({ type: 'way', ref: id, role: 'forward' })),
    });
    cache.set(r.id, r);
    return r;
}

export function way(id: number, nodes: number[]): Way {
    const w = new Way(pack({ type: 'way', id }), {
        type: 'way',
        id,
        nodes,
    });
    cache.set(w.id, w);
    return w;
}

export function node(id: number, lat: number, lon: number): Node {
    const n = new Node(pack({ type: 'node', id }), {
        type: 'node',
        id,
        lat, lon,
    });
    cache.set(n.id, n);
    return n;
}

export function relations(...ids: number[]): Relation[] {
    return ids.map(id => cache.get(pack({ type: 'relation', id })) as Relation);
}

export function ways(...ids: number[]): Way[] {
    return ids.map(id => cache.get(pack({ type: 'way', id })) as Way);
}

export function nodes(...ids: number[]): Node[] {
    return ids.map(id => cache.get(pack({ type: 'node', id })) as Node);
}