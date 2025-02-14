import { expect, test } from 'vitest';

import { setup, SetupType, relation, relations, ways, nodes } from './test_common';

import { calcRelationPath, calcWayGroupPath, calcWayPath } from '../boundary_calc';
import { reverse } from '../id';
import { LatLngTuple } from 'leaflet';

/* eslint:disable-next-line @typescript-eslint/no-unused-vars */
function fakeDistanceFn(a: LatLngTuple, b: LatLngTuple): number {
    return 10;
}

test('Way path forward', () => {
    setup(SetupType.Way);
    const [w] = ways(4);
    const [n4, n5, n6] = nodes(4, 5, 6);
    const path = calcWayPath(w.id, w);
    expect(path).toEqual([
        [n4.lat, n4.lon],
        [n5.lat, n5.lon],
        [n6.lat, n6.lon],
    ]);
});

test('Way path reverse', () => {
    setup(SetupType.Way);
    const [w] = ways(4);
    const [n4, n5, n6] = nodes(4, 5, 6);
    const path = calcWayPath(reverse(w.id), w);
    expect(path).toEqual([
        [n6.lat, n6.lon],
        [n5.lat, n5.lon],
        [n4.lat, n4.lon],
    ]);
});

test('WayGroup path no reverse', () => {
    setup(SetupType.Relation);
    const wg = relations(1)[0].children[0];
    const path = calcWayGroupPath(wg, ['w:3']);
    const realPath = nodes(4, 5, 6, 7).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('WayGroup path with reverse', () => {
    setup(SetupType.Way);

    const wg = relation(1, [3, 40, 5]).children[0];
    const path = calcWayGroupPath(wg, ['w:3']);
    const realPath = nodes(4, 5, 6, 7).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('Relation path no reverse', () => {
    setup(SetupType.Relation);
    const r = relations(1)[0];
    const path = calcRelationPath(r, [], fakeDistanceFn);
    const realPath = nodes(3, 4, 5, 6, 7).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});