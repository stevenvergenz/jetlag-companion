import { ReactNode, useState, RefObject, useContext } from 'react';
import { Map } from 'leaflet';

// import { BoundaryConfig } from './boundary_config';
import { BoundaryEditMode, SharedContext } from '../context';
import { StationConfig } from './station_config';
import Welcome from './welcome';
import BoundaryInit from './boundary_init';
import BoundaryAdjust from './boundary_adjust';
import ExportTab from './export';

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
        : tab === Tab.Export ? <ExportTab />
        : <div>Unknown Tab</div>;

    function advanceTab(dir = 1 | -1) {
        const newTab = tab + dir;
        switch (newTab) {
            case Tab.Welcome:
            case Tab.Stations:
            case Tab.Export:
                setTab(newTab);
                setBoundaryEditing(BoundaryEditMode.None);
                break;
            case Tab.BoundaryInit:
                setTab(newTab);
                setBoundaryEditing(BoundaryEditMode.Init);
                break;
            case Tab.BoundaryAdjust:
                setTab(newTab);
                setBoundaryEditing(BoundaryEditMode.Adjust);
                break;
            default:
                break;
        }
    }

    return <div className={
        'w-1/3 grow-0 overflow-y-auto max-h-screen ' +
        'bg p-4 gap-2 flex flex-col content-stretch text-center'}>
        <h1>Jet Lag Companion</h1>
        <div className='flex-grow overflow-auto flex justify-center'>
            { renderTab }
        </div>
        <div className='flex flex-row justify-between'>
            <button disabled={tab === Tab.Welcome} onClick={() => advanceTab(-1)}>
                Back
            </button>
            <button disabled={tab === Tab.Export} onClick={() => advanceTab(1)}>
                Next
            </button>
        </div>
    </div>;
}