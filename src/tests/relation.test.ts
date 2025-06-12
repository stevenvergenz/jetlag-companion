import { expect, test } from 'vitest';
import { setup, nodes, ways } from './test_common';
import { Element, Node, Way, getSyntheticId, Id, unpack, OsmElement } from '../data/index';

test('has', () => {
    setup();

    const [w] = ways(1);
    expect(w.has('n:1')).toBeTruthy();
});