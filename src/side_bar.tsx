import { ReactNode } from 'react';

import { BoundaryConfig } from './boundary_config';

export function SideBar(): ReactNode {
    return <div className={
        'w-30 max-w-md overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch'}>
        <BoundaryConfig />
    </div>;
}