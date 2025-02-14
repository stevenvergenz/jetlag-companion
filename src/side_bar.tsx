import { ReactNode } from 'react';

import { BoundaryConfig } from './boundary_config';
import { StationConfig } from './station_config';

export function SideBar(): ReactNode {
    return <div className={
        'min-w-fit max-w-md overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch'}>
        <BoundaryConfig />
        <StationConfig />
    </div>;
}