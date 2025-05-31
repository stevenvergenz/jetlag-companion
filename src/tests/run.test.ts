import { expect, test } from 'vitest';
import { setup, relation } from './test_common';
import { Element, Id, Run } from '../data/index';

function checkChildren(e: Element, ids: Id[]) {
    expect(e.childRefs.map(r => r.id)).toEqual(ids);
    expect(e.childRefs.map(r => r.element?.id)).toEqual(ids);
}

function checkParents(e: Element, ids: Id[]) {
    expect(e.parentRefs.map(r => r.id)).toEqual(ids);
    expect(e.parentRefs.map(r => r.element?.id)).toEqual(ids);
}

test('run append forward', () => {
    setup();

    const r = relation(1, [3, 4]);
    Run.generateFromRelation(r);
    checkChildren(r, ['w:3', 'w:4', 'r:-1']);

    const run = r.childrenOfType(Run)[0];
    expect(run).toBeInstanceOf(Run);
    checkParents(run, [r.id]);
    checkChildren(run, ['w:3', 'w:4']);

    for (const w of run.childRefs.map(r => r.element!)) {
        checkParents(w, [r.id, run.id]);
    }

    expect(run.firstNodeId).toBe('n:3');
    expect(run.lastNodeId).toBe('n:6');
});

test('run prepend forward', async () => {
    setup();

    const r = relation(2, [5, 4]);
    const runs = await Run.generateFromRelation(r);
    checkChildren(r, ['w:5', 'w:4', 'r:-1']);

    const run = runs[0];
    expect(run).toBeInstanceOf(Run);
    checkParents(run, [r.id]);
    checkChildren(run, ['w:4', 'w:5']);

    for (const c of run.childRefs) {
        checkParents(c.element!, [r.id, run.id]);
    }

    expect(run.firstNodeId).toBe('n:4');
    expect(run.lastNodeId).toBe('n:7');
});

/*
test('wayGroup append reverse', () => {
    setup();

    const r = relation(3, [3, 400]);
    r.calcWayGroups();
    checkChildren(r, ['w:3', 'w:400', 'wg:3/0']);

    const wg = r.children[2] as WayGroup;
    expect(wg).toBeInstanceOf(WayGroup);
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', '-w:400']);

    for (const w of wg.children) {
        checkParents(w, [r.id, wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:6');
});

test('wayGroup prepend reverse', () => {
    setup();

    const r = relation(4, [5, 400]);
    r.calcWayGroups();
    checkChildren(r, ['w:5', 'w:400', 'wg:4/0']);

    const wg = r.children[2] as WayGroup;
    expect(wg).toBeInstanceOf(WayGroup);
    checkParents(wg, [r.id]);
    checkChildren(wg, ['-w:400', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [r.id, wg.id]);
    }
    
    expect(wg.startsWithNode).toBe('n:4');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup bridge append forward', () => {
    setup();

    const r = relation(5, [3, 5, 4]);
    r.calcWayGroups();
    checkChildren(r, ['w:3', 'w:5', 'w:4', 'wg:5/0']);

    const wg = r.children[3] as WayGroup;
    expect(wg).toBeInstanceOf(WayGroup);
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', 'w:4', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [r.id, wg.id]);
    }
    
    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup bridge prepend forward', () => {
    setup();

    const r = relation(6, [5, 3, 4]);
    r.calcWayGroups();
    checkChildren(r, ['w:5', 'w:3', 'w:4', 'wg:6/0']);

    const wg = r.children[3] as WayGroup;
    expect(wg).toBeInstanceOf(WayGroup);
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', 'w:4', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [r.id, wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:7');
});

test('wayGroup bridge append reverse', () => {
    setup();

    const r = relation(7, [3, 700, 400]);
    r.calcWayGroups();
    checkChildren(r, ['w:3', 'w:700', 'w:400', 'wg:7/0']);
    
    const wg = r.children[3] as WayGroup;
    expect(wg).toBeInstanceOf(WayGroup);
    checkParents(wg, [r.id]);
    checkChildren(wg, ['w:3', '-w:400', '-w:700']);

    for (const w of wg.children) {
        checkParents(w, [r.id, wg.id]);
    }
    
    expect(wg.startsWithNode).toBe('n:3');
    expect(wg.endsWithNode).toBe('n:13');
});

test('wayGroup bridge prepend reverse', () => {
    setup();

    const r = relation(8, [5, 6, 400]);
    r.calcWayGroups();
    checkChildren(r, ['w:5', 'w:6', 'w:400', 'wg:8/0']);
    
    const wg = r.children[3] as WayGroup;
    expect(wg).toBeInstanceOf(WayGroup);
    checkParents(wg, [r.id]);
    checkChildren(wg, ['-w:6', '-w:400', 'w:5']);

    for (const w of wg.children) {
        checkParents(w, [r.id, wg.id]);
    }

    expect(wg.startsWithNode).toBe('n:11');
    expect(wg.endsWithNode).toBe('n:7');
});
*/