import { ReactNode, useState } from 'react';

// import { BoundaryConfig } from './boundary_config';
import { StationConfig } from './station_config';
import Welcome from './welcome';

enum Tab {
    Welcome,
    BoundaryInit,
    BoundaryAdjust,
    Stations,
    Export,
}

export default function SideBar(): ReactNode {
    const [tab, setTab] = useState<Tab>(Tab.Welcome);

    const renderTab: ReactNode
        = tab === Tab.Welcome ? <Welcome />
        : tab === Tab.BoundaryInit ? <div>Boundary Init Placeholder</div>
        : tab === Tab.BoundaryAdjust ? <div>Boundary Adjust Placeholder</div>
        : tab === Tab.Stations ? <StationConfig />
        : tab === Tab.Export ? <div>Export Placeholder</div>
        : <div>Unknown Tab</div>;

    function nextTab() {
        switch (tab) {
            case Tab.Export:
                break;
            default:
                setTab(tab + 1);
                break;
        }
    }

    function prevTab() {
        switch (tab) {
            case Tab.Welcome:
                break;
            default:
                setTab(tab - 1);
                break;
        }
    }

    return <div className={
        'min-w-md max-w-md overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch text-center'}>
        <h1 className='text-xl font-bold'>Jet Lag: The Game - Companion</h1>
        <div>
            { renderTab }
        </div>
        <div className='flex flex-row justify-between'>
            <button className='btn btn-primary' onClick={prevTab}>
                Back
            </button>
            <button className='btn btn-primary' onClick={nextTab}>
                Next
            </button>
        </div>
    </div>;
}