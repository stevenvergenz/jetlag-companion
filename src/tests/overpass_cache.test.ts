import { expect, test } from 'vitest';
import { dbClear, getAsync } from '../overpass_cache';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test('request then get', async () => {
    await dbClear();

    await Promise.all([getAsync(['r:2859048'], { request: true }), sleep(1000)]); // WA 520
    await expect(getAsync(['r:2859048'], { request: false })).resolves.toHaveLength(1);
});

test('get then request', async () => {
    await dbClear();

    const p = getAsync(['r:1071195'], { request: false });
    await sleep(1000);
    await getAsync(['r:1071195'], { request: true }); // I-405
    await expect(p).resolves.toHaveLength(1);
});

test('request and get', async () => {
    await dbClear();

    const p2 = getAsync(['r:3219090'], { request: false }); // WA 518
    const p1 = getAsync(['r:3219090'], { request: true });
    await Promise.all([
        expect(p1).resolves.toHaveLength(1),
        expect(p2).resolves.toHaveLength(1),
    ]);
});