import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react';
import { DefaultConfig, load, save } from '../config';
import { ContextProvider } from '../context';
import { BoundaryConfig } from '../boundary_config';

test('add and save', async () => {
    save(DefaultConfig);
    const { getByPlaceholder, getByRole } = render(
        <ContextProvider>
            <BoundaryConfig />
        </ContextProvider>
    );

    const input = getByPlaceholder('OSM Relation ID');
    await expect.element(input).toBeInTheDocument();
    await input.fill('13316229');

    const button = getByRole('button', { name: 'Add' });
    await expect.element(button).toBeInTheDocument();
    await button.click();

    const newConfig = load();
    expect(newConfig.boundary.included).toEqual(new Set(['r:13316229']));
});