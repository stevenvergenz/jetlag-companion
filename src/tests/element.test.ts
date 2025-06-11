import { expect, test } from 'vitest';
import { setup, nodes } from './test_common';
import { Element, getSyntheticId, Id, unpack, OsmElement } from '../data/index';

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