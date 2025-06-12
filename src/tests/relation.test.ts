import { expect, test } from 'vitest';
import { setup, relations } from './test_common';

test('has', () => {
    setup();

    const [r] = relations(1);
    expect(r.has('n:4')).toBe(true);
    expect(r.has('n:5')).toBe(false);
});

test('firstElementWithRole', () => {
    setup();

    const [r] = relations(1);
    expect(r.firstElementWithRole('platform'))
        .toMatchObject(expect.objectContaining({ id: 'n:4'}));
});

test('allElementsWithRole', () => {
    setup();

    const [r] = relations(1);
    expect(r.allElementsWithRole('platform')).toMatchObject([
        expect.objectContaining({ id: 'n:4' }),
        expect.objectContaining({ id: 'n:6' }),
    ]);
});