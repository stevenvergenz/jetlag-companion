import { expect, test } from 'vitest';

import { setup, relation, ways, nodes } from './test_common';

import { calcIntersection, calcRelationPath, calcWayGroupPath, calcWayPath, mergeRelations } from '../boundary_calc';
import { reverse } from '../id';
import { LatLngTuple } from 'leaflet';

function distance(a: LatLngTuple, b: LatLngTuple): number {
    const dx = a[0] - b[0];
    const dy = a[1] - b[1];
    return 200 * Math.sqrt(dx * dx + dy * dy);
}

test('Way path', () => {
    setup();
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
    setup();
    const [w] = ways(4);
    const [n4, n5, n6] = nodes(4, 5, 6);
    const path = calcWayPath(reverse(w.id), w);
    expect(path).toEqual([
        [n6.lat, n6.lon],
        [n5.lat, n5.lon],
        [n4.lat, n4.lon],
    ]);
});

test('WayGroup path', () => {
    setup();
    const wg = relation(1, [3, 4, 5]).children[0];
    const path = calcWayGroupPath(wg, ['w:3']);
    const realPath = nodes(4, 5, 6, 7).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('WayGroup path reverse', () => {
    setup();
    const wg = relation(1, [3, 400, 5]).children[0];
    const path = calcWayGroupPath(wg, ['w:3']);
    const realPath = nodes(4, 5, 6, 7).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('Relation path', () => {
    setup();
    const r = relation(1, [3, 4, 5]);
    const path = calcRelationPath(r, [], distance);
    const realPath = nodes(3, 4, 5, 6, 7).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('Relation path gap', () => {
    setup();
    const r = relation(1, [1, 11]);
    const path = calcRelationPath(r, [], distance);
    const realPath = nodes(1, 4, 11, 15).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('Relation path gap reverse', () => {
    setup();
    const r = relation(1, [1, 1100]);
    const path = calcRelationPath(r, [], distance);
    const realPath = nodes(1, 4, 11, 15).map(n => [n.lat, n.lon]);
    expect(path).toEqual(realPath);
});

test('Intersection direct', () => {
    setup();
    const [n1, n3, n4] = nodes(1, 3, 4);
    const i = calcIntersection({
        start: [n1.lat, n1.lon],
        end: [n4.lat, n4.lon],
        bounds: [n4.lat, n4.lon, n1.lat, n1.lon],
    }, {
        start: [n3.lat, n3.lon],
        end: [n4.lat, n4.lon],
        bounds: [n4.lat, n4.lon, n3.lat, n3.lon],
    });
    expect(i).toEqual([n4.lat, n4.lon]);
});

test('Intersection indirect', () => {
    setup();
    const [n1, n3, n4, n5, n8] = nodes(1, 3, 4, 5, 8);
    const i = calcIntersection({
        start: [n3.lat, n3.lon],
        end: [n5.lat, n5.lon],
        bounds: [n3.lat, n3.lon, n5.lat, n5.lon],
    }, {
        start: [n1.lat, n1.lon],
        end: [n8.lat, n8.lon],
        bounds: [n8.lat, n8.lon, n1.lat, n1.lon],
    });
    expect(i).toEqual([n4.lat, n4.lon]);
});

test('Merge open', () => {
    setup();
    const r1 = relation(1, [600]);
    const r2 = relation(2, [4]);
    const r3 = relation(3, [7]);
    const loop = mergeRelations([r1, r2, r3], [], distance);
    expect(loop).toBe(undefined);
});

test('Merge closed', () => {
    setup();
    const r1 = relation(1, [600]);
    const r2 = relation(2, [4]);
    const r3 = relation(3, [7]);
    const r4 = relation(4, [9]);
    const loop = mergeRelations([r1, r2, r3, r4], [], distance);
    const realLoop = nodes(4, 8, 11, 12, 13, 9, 6, 5).map(n => [n.lat, n.lon]);
    expect(loop).toEqual(realLoop);
});