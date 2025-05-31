import { expect, test, beforeEach } from 'vitest';
import { dbClear, getAsync, get } from '../util/overpass_cache';
import { Element } from '../data/index';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(async () => {
    await dbClear({ clearCache: false });
});


test('request then get', async () => {
    await Promise.all([
        getAsync(['r:2859048'], { request: true, cache: true }),
        sleep(1000)]);
    await expect(
        getAsync(['r:2859048'], { request: false, cache: false })
    ).resolves.toHaveLength(1);
});

test('get then request', async () => {
    const p = getAsync(['r:2859048'], { request: false, cache: false });
    await sleep(1000);
    await getAsync(['r:2859048'], { request: true, cache: true });
    await expect(p).resolves.toHaveLength(1);
});

test('request and get', async () => {
    const p2 = getAsync(['r:2859048'], { request: false, cache: false });
    const p1 = getAsync(['r:2859048'], { request: true, cache: true });
    await Promise.all([
        expect(p1).resolves.toHaveLength(1),
        expect(p2).resolves.toHaveLength(1),
    ]);
});

test('double request', async () => {
    const p1 = getAsync(['r:2859048'], { request: true, cache: true });
    const p2 = getAsync(['r:2859048'], { request: true, cache: true });
    await Promise.all([
        expect(p1).resolves.toHaveLength(1),
        expect(p2).resolves.toHaveLength(1),
    ]);
});

test('get sync', async () => {
    await expect(getAsync(['r:2859048'], { request: true, cache: true })).resolves.toHaveLength(1);
    const r = get('r:2859048', Element);
    expect(r).toBeDefined();
});