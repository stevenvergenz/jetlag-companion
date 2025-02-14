import { expect, test } from 'vitest';

import { Relation, Way, Node } from '../osm_element';
import { cache } from '../overpass_api';
import { pack } from '../id';

function setup() {
    cache.clear();

    cache.set('n:1', new Node('n:1', { type: 'node', id: 1, lat:  1, lon: -1 }));
    cache.set('n:2', new Node('n:2', { type: 'node', id: 2, lat:  1, lon:  0 }));
    cache.set('n:3', new Node('n:3', { type: 'node', id: 3, lat:  1, lon:  1 }));
    cache.set('n:4', new Node('n:4', { type: 'node', id: 4, lat:  0, lon:  1 }));
    cache.set('n:5', new Node('n:5', { type: 'node', id: 5, lat: -1, lon:  1 }));
    cache.set('n:6', new Node('n:6', { type: 'node', id: 6, lat: -1, lon:  0 }));
    cache.set('n:7', new Node('n:7', { type: 'node', id: 7, lat: -1, lon: -1 }));
    cache.set('n:8', new Node('n:8', { type: 'node', id: 8, lat:  0, lon: -1 }));
    
    cache.set('w:1', new Way('w:1', { type: 'way', id: 1, nodes: [1, 2] }));
    cache.set('w:2', new Way('w:2', { type: 'way', id: 2, nodes: [2, 3] }));
    cache.set('w:3', new Way('w:3', { type: 'way', id: 3, nodes: [3, 4] }));
    
    cache.set('w:4', new Way('w:4', { type: 'way', id: 4, nodes: [4, 3] }));
    cache.set('w:5', new Way('w:5', { type: 'way', id: 5, nodes: [3, 2] }));
    cache.set('w:6', new Way('w:6', { type: 'way', id: 6, nodes: [2, 1] }));
}

function relation(id: number, members: number[]): Relation {
    const r = new Relation(pack({ type: 'relation', id }), {
        type: 'relation',
        id,
        members: members.map(id => ({ type: 'way', ref: id, role: 'forward' })),
    });
    cache.set(r.id, r);
    return r;
}

test('wayGroup append forward', () => {
    setup();
    const r = relation(1, [1, 2]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['w:1', 'w:2']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:3');
});

test('wayGroup prepend forward', () => {
    setup();
    const r = relation(2, [2, 1]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['w:1', 'w:2']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:3');
});

test('wayGroup append reverse', () => {
    setup();
    const r = relation(3, [1, 5]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['w:1', '-w:5']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:3');
});

test('wayGroup prepend reverse', () => {
    setup();
    const r = relation(4, [2, 6]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['-w:6', 'w:2']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:3');
});

test('wayGroup bridge append forward', () => {
    setup();
    const r = relation(5, [1, 3, 2]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['w:1', 'w:2', 'w:3']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:4');
});

test('wayGroup bridge prepend forward', () => {
    setup();
    const r = relation(6, [3, 1, 2]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['w:1', 'w:2', 'w:3']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:4');
});

test('wayGroup bridge append reverse', () => {
    setup();
    const r = relation(7, [1, 4, 5]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['w:1', '-w:5', '-w:4']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:4');
});

test('wayGroup bridge prepend reverse', () => {
    setup();
    const r = relation(8, [3, 6, 5]);
    expect(r.wayGroups.size).toBe(1);
    expect(r.children[0].childIds).toMatchObject(['-w:6', '-w:5', 'w:3']);
    expect(r.children[0].startsWithNode).toBe('n:1');
    expect(r.children[0].endsWithNode).toBe('n:4');
});

test('parentage', () => {
    setup();
    const r = relation(9, [1, 4, 5]);
    expect(r.childIds.length).toBe(1);
    expect(r.children.length).toBe(1);

    const wg = r.children[0];
    expect(wg.parentIds.size).toBe(1);
    expect(wg.parents.length).toBe(1);
    expect(wg.childIds.length).toBe(3);
    expect(wg.children.length).toBe(3);

    const w0 = wg.children[0];
    expect(w0.parentIds.size).toBe(1);
    expect(w0.parents.length).toBe(1);
    expect(w0.childIds.length).toBe(2);
    expect(w0.children.length).toBe(2);

    const w1 = wg.children[1];
    expect(w1.parentIds.size).toBe(1);
    expect(w1.parents.length).toBe(1);
    expect(w1.childIds.length).toBe(2);
    expect(w1.children.length).toBe(2);

    const w2 = wg.children[2];
    expect(w2.parentIds.size).toBe(1);
    expect(w2.parents.length).toBe(1);
    expect(w2.childIds.length).toBe(2);
    expect(w2.children.length).toBe(2);

    const n = w0.children[0];
    expect(n.parentIds.size).toBe(2);
    expect(n.parents.length).toBe(2);
    expect(n.childIds.length).toBe(0);
});