import { expect, test } from 'vitest';
import { cache, getAsync, requestAsync } from '../overpass_api';

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

test('request then get', async () => {
    cache.clear();

    await Promise.all([requestAsync('r:2859048'), sleep(1000)]); // WA 520
    await expect(getAsync('r:2859048')).resolves.toHaveLength(1);
});

test('get then request', async () => {
    cache.clear();

    const p = getAsync('r:1071195');
    await sleep(1000);
    await requestAsync('r:1071195'); // I-405
    await expect(p).resolves.toHaveLength(1);
});



test('request and get', async () => {
    cache.clear();

    const p2 = requestAsync('r:3219090'); // WA 518
    const p1 = getAsync('r:3219090');
    await Promise.all([
        expect(p1).resolves.toHaveLength(1),
        expect(p2).resolves.toHaveLength(1),
    ]);
});