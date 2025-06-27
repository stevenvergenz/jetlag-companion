import { ReactNode, useState, RefObject, useContext } from 'react';
import { Map } from 'leaflet';

// import { BoundaryConfig } from './boundary_config';
import { SharedContext } from '../context';
import { StationConfig } from './station_config';
import Welcome from './welcome';
import BoundaryInit from './boundary_init';
import BoundaryAdjust from './boundary_adjust';

enum Tab {
    Welcome,
    BoundaryInit,
    BoundaryAdjust,
    Stations,
    Export,
}

export default function SideBar({ mapRef }: { mapRef: RefObject<Map> }): ReactNode {
    const { setBoundaryEditing } = useContext(SharedContext);
    const [tab, setTab] = useState<Tab>(Tab.Welcome);

    const renderTab: ReactNode
        = tab === Tab.Welcome ? <Welcome />
        : tab === Tab.BoundaryInit ? <BoundaryInit mapRef={mapRef}/>
        : tab === Tab.BoundaryAdjust ? <BoundaryAdjust />
        : tab === Tab.Stations ? <StationConfig />
        : tab === Tab.Export ? <div>Export Placeholder</div>
        : <div>Unknown Tab</div>;

    function nextTab() {
        switch (tab) {
            case Tab.Export:
                break;
            default:
                setTab(tab + 1);
                setBoundaryEditing((tab + 1) === Tab.BoundaryAdjust);
                break;
        }
    }

    function prevTab() {
        switch (tab) {
            case Tab.Welcome:
                break;
            default:
                setTab(tab - 1);
                setBoundaryEditing((tab - 1) === Tab.BoundaryAdjust);
                break;
        }
    }

    return <div className={
        'w-1/3 grow-0 overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch text-center'}>
        <h1>Jet Lag Companion</h1>
        <div className='flex-grow overflow-auto flex flex-col justify-center align-center'>
            { renderTab }
        </div>
        <div className='flex flex-row justify-between'>
            <button disabled={tab === Tab.Welcome} onClick={prevTab}>
                Back
            </button>
            <button disabled={tab === Tab.Export} onClick={nextTab}>
                Next
            </button>
        </div>
    </div>;
}