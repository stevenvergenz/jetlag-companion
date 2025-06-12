import { expect, test } from 'vitest';
import { setup, nodes, ways } from './test_common';
import { Element, Node, Way, getSyntheticId, Id, unpack, OsmElement } from '../data/index';

class FakeElement extends Element {
    public constructor(id: Id, data: OsmElement) {
        super(id, data);
    }

    public addChild(e: Element, role?: string, index?: number) {
        super.addChild(e, role, index);
    }

    public addParent(e: Element, role?: string) {
        super.addParent(e, role);
    }
}

test('addChild', () => {
    setup();

    const id = getSyntheticId('relation');
    const { id: uid } = unpack(id);
    const e = new FakeElement(id, { type: 'relation', id: uid, members: [] });
    expect(e.childRefs.length).toBe(0);

    const [n] = nodes(1);
    e.addChild(n);
    expect(e.childRefs).toHaveLength(1);
    expect(e.childRefs[0].id).toBe(n.id);
    expect(e.childRefs[0].role).toBeUndefined();
    expect(e.childRefs[0].element).toMatchObject(n);

    const parentRef = n.parentRefs.find(r => r.id === e.id);
    expect(parentRef).toBeTruthy();
    expect(parentRef?.element).toMatchObject(e);
});

test('addParent', () => {
    setup();

    const id = getSyntheticId('relation');
    const { id: uid } = unpack(id);
    const e = new FakeElement(id, { type: 'relation', id: uid, members: [] });
    expect(e.parentRefs.length).toBe(0);

    const [n] = nodes(1);
    e.addParent(n, undefined);
    expect(e.parentRefs).toHaveLength(1);
    expect(e.parentRefs[0].id).toBe(n.id);
    expect(e.parentRefs[0].role).toBeUndefined();
    expect(e.parentRefs[0].element).toMatchObject(n);

    const childRef = n.childRefs.find(r => r.id === e.id && r.role === e.parentRefs[0].role);
    expect(childRef).toBeTruthy();
    expect(childRef?.role).toEqual(e.parentRefs[0].role);
    expect(childRef?.element).toMatchObject(e);
});

test('childRefsOfType (typed))', () => {
    setup();

    const [w] = ways(4);
    expect(w.childRefsOfType(Node)).toMatchObject([
        { id: 'n:4', element: expect.objectContaining({ id: 'n:4' }) },
        { id: 'n:5', element: expect.objectContaining({ id: 'n:5' }) },
        { id: 'n:6', element: expect.objectContaining({ id: 'n:6' }) },
    ]);

    expect(w.childRefsOfType(Way)).toHaveLength(0);
});

test('childRefsOfType (untyped))', () => {
    setup();

    const [w] = ways(4);
    expect(w.childRefsOfType('node')).toMatchObject([
        { id: 'n:4', element: expect.objectContaining({ id: 'n:4' }) },
        { id: 'n:5', element: expect.objectContaining({ id: 'n:5' }) },
        { id: 'n:6', element: expect.objectContaining({ id: 'n:6' }) },
    ]);

    expect(w.childRefsOfType('way')).toHaveLength(0);
});

test('parentRefsOfType (typed))', () => {
    setup();

    const [n] = nodes(5);
    expect(n.parentRefsOfType(Way)).toMatchObject([
        { id: 'w:4', element: expect.objectContaining({ id: 'w:4' }) },
        { id: 'w:400', element: expect.objectContaining({ id: 'w:400' }) },
    ]);

    expect(n.parentRefsOfType(Node)).toHaveLength(0);
});

test('parentRefsOfType (untyped)', () => {
    setup();

    const [n] = nodes(5);
    expect(n.parentRefsOfType('way')).toMatchObject([
        { id: 'w:4', element: expect.objectContaining({ id: 'w:4' }) },
        { id: 'w:400', element: expect.objectContaining({ id: 'w:400' }) },
    ]);

    expect(n.parentRefsOfType('node')).toHaveLength(0);
});

test('childrenOfType', () => {
    setup();

    const [w] = ways(4);
    expect(w.childrenOfType(Node)).toMatchObject([
        expect.objectContaining({ id: 'n:4' }),
        expect.objectContaining({ id: 'n:5' }),
        expect.objectContaining({ id: 'n:6' }),
    ]);

    expect(w.childrenOfType(Way)).toHaveLength(0);
});



test('parentsOfType', () => {
    setup();

    const [n] = nodes(5);
    expect(n.parentsOfType(Way)).toMatchObject([
        expect.objectContaining({ id: 'w:4' }),
        expect.objectContaining({ id: 'w:400' }),
    ]);

    expect(n.parentsOfType(Node)).toHaveLength(0);
});