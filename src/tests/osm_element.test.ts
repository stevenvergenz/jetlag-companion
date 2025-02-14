import { expect, test } from 'vitest';
import { setup, SetupType, relation } from './test_common';
import { Element } from '../osm_element';
import { Id, unreversed } from '../id';

function checkChildren(e: Element, ids: Id[]) {
    expect(e.childIds).toEqual(ids);
    expect(e.children.map(c => c.id)).toEqual(ids.map(id => unreversed(id)));
}

function checkParents(e: Element, ids: Id[]) {
    const ps = new Set(ids);
    expect(e.parentIds).toEqual(ps);
    expect(new Set(e.parents.map(c => c.id))).toEqual(ps);
}

test('wayGroup append forward', () => {
    setup(SetupType.Way);

    const r = relation(1, [3, 4]);
    checkChildren(r, ['wg:1/0']);

    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', 'w:4']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:6');
});

test('wayGroup prepend forward', () => {
    setup(SetupType.Way);

    const r = relation(2, [5, 4]);
    checkChildren(r, ['wg:2/0']);

    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:4', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:4');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup append reverse', () => {
    setup(SetupType.Way);

    const r = relation(3, [3, 40]);
    checkChildren(r, ['wg:3/0']);

    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', '-w:40']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:6');
});

test('wayGroup prepend reverse', () => {
    setup(SetupType.Way);

    const r = relation(4, [5, 40]);
    checkChildren(r, ['wg:4/0']);

    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['-w:40', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }
    
    expect(wg.startsWithNode).toBe('n:4');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup bridge append forward', () => {
    setup(SetupType.Way);

    const r = relation(5, [3, 5, 4]);
    checkChildren(r, ['wg:5/0']);

    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', 'w:4', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }
    
    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup bridge prepend forward', () => {
    setup(SetupType.Way);

    const r = relation(6, [5, 3, 4]);
    checkChildren(r, ['wg:6/0']);

    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', 'w:4', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup bridge append reverse', () => {
    setup(SetupType.Way);

    const r = relation(7, [3, 70, 40]);
    checkChildren(r, ['wg:7/0']);
    
    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', '-w:40', '-w:70']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }
    
    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:13');
});

test('wayGroup bridge prepend reverse', () => {
    setup(SetupType.Way);

    const r = relation(8, [5, 6, 40]);
    checkChildren(r, ['wg:8/0']);
    
    const wg = r.children[0];
    checkParents(wg, [r.id]);
    checkChildren(wg, ['-w:6', '-w:40', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:11');
    expect(wg.endsWithNode).toBe('n:7');
});
