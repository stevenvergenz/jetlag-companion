import { expect, test } from 'vitest';

import { Relation, WayGroup, Way, Node } from '../osm_element';
import { cache, get } from '../overpass_api';

function setup() {
    cache.clear();

    cache.set('n:1', new Node('n:1', { type: 'node', id: 1, lat: 0, lon: 0 }));
    cache.set('n:2', new Node('n:2', { type: 'node', id: 2, lat: 0, lon: 0 }));
    cache.set('n:3', new Node('n:3', { type: 'node', id: 3, lat: 0, lon: 0 }));
    cache.set('n:4', new Node('n:4', { type: 'node', id: 4, lat: 0, lon: 0 }));
    
    cache.set('w:1', new Way('w:1', { type: 'way', id: 1, nodes: [1, 2] }));
    cache.set('w:2', new Way('w:2', { type: 'way', id: 2, nodes: [2, 3] }));
    cache.set('w:3', new Way('w:3', { type: 'way', id: 3, nodes: [3, 4] }));

    cache.set('r:1', new Relation('r:1', { type: 'relation', id: 1, members: [
        { type: 'way', ref: 1, role: 'forward' },
        { type: 'way', ref: 2, role: 'forward' },
        { type: 'way', ref: 3, role: 'forward' },
    ]}));
    cache.set('r:2', new Relation('r:2', { type: 'relation', id: 2, members: [
        { type: 'way', ref: 1, role: 'forward' },
        { type: 'way', ref: 3, role: 'forward' },
        { type: 'way', ref: 2, role: 'forward' },
    ]}));
}

test('wayGroup append', () => {
    setup();
    const r = get('r:1')! as Relation;
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:4');
});

test('wayGroup bridge', () => {
    setup();
    const r = get('r:2')! as Relation;
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:4');
})