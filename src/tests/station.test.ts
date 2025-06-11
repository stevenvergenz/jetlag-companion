import { expect, test } from 'vitest';
import { setup, nodes } from './test_common';
import { Station } from '../data/index';

test('station append', () => {
    setup();

    const [p1, pGood, pBad] = nodes(4, 6, 11);

    const s = new Station(p1);

    expect(s.tryAdd(pGood)).toBeTruthy();
    expect(s.childRefs.find(cRef => cRef.id === pGood.id)).toBeTruthy();
    expect(pGood.parentRefs.find(pRef => pRef.id === s.id)).toBeTruthy();

    expect(s.tryAdd(pBad)).toBeFalsy();
});