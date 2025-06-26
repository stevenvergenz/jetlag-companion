import { ReactNode, useContext, useState } from 'react';

import { Id, unpack, Way, Node, Station } from '../data';
import { TreeNode } from '../util/tree_node';
import { SharedContext } from '../context';
import { getByTransportTypeAsync, memCacheId } from '../util/overpass_cache';

export function StationConfig(): ReactNode {
    const {
        boundaryPoints,
        showStations,
        busRouteThreshold,
        trainRouteThreshold,
        stations, setStations,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const [calcStarted, setCalcStarted] = useState(false);

    function setShowStations(show: boolean) {
        save({
            stations: {
                show,
            },
        });
    }

    function setTrainRouteThreshold(threshold: number) {
        save({
            stations: {
                trainRouteThreshold: threshold,
            },
        });
    }

    function setBusRouteThreshold(threshold: number) {
        save({
            stations: {
                busRouteThreshold: threshold,
            },
        });
    }
    
    function genLabel(station: Station) {
        const { type, id } = unpack(station.childRefs[0].id);
        return <label>
            {station.name} (
            <a target='_blank' href={`https://www.openstreetmap.org/${type}/${id}`}>{station.childRefs[0].id}</a>
            )
        </label>;
    }

    async function calcStations() {
        if (!boundaryPoints || boundaryPoints.length < 2 || calcStarted) {
            return;
        }

        setCalcStarted(true);
        const platforms = await getByTransportTypeAsync<Way | Node>(
            boundaryPoints, 
            'platform',
            { request: true },
        );
        console.log(`[station] ${platforms.length} platforms found`);

        const tempStations = platforms.flatMap(platform => {
            return platform.parentRefs.flatMap(pRef => {
                return pRef.element instanceof Station && pRef.role === 'platform' ? [pRef.element as Station] : [];
            });
        });
        console.log(`[station] Found ${tempStations.length} existing stations`);

        for (const platform of platforms) {
            const matchingStations = tempStations.filter(s => s.tryAdd(platform));
            if (matchingStations.length === 0) {
                const newStation = new Station(platform);
                memCacheId.set(newStation.id, newStation);
                tempStations.push(newStation);
            }
        }
        console.log(`[station] ${tempStations.length} stations found`);

        setStations(tempStations);
    }

    function hoverStart(id: Id) {
        return () => {
            if (hovering !== id) {
                setHovering(id);
            }
        };
    }

    function hoverEnd(id: Id) {
        return () => {
            if (hovering === id) {
                setHovering('');
            }
        };
    }

    if (stations.length === 0 && !calcStarted) {
        calcStations();
        return;
    }

    const stationElems = stations
        .filter(s => s.shouldShow({ busRouteThreshold, trainRouteThreshold }))
        .map(s => {
            return <TreeNode id={s.id} key={s.id} initiallyOpen={true}
                onMouseEnter={hoverStart(s.id)} onMouseLeave={hoverEnd(s.id)} >
                {genLabel(s)}
            </TreeNode>;
        });

    return <TreeNode id='stations' initiallyOpen={true}>
        <label className='font-bold'>
            <input type='checkbox' checked={showStations} onChange={e => setShowStations(e.target.checked)} />
            &nbsp; Stations ({stationElems.length})
        </label>
        <TreeNode id='station-settings' initiallyOpen={true}>
            <span className='font-bold'>Settings</span>
            <label>
                <input type='number' min='0' max='10'
                    value={trainRouteThreshold} onChange={e => setTrainRouteThreshold(e.target.valueAsNumber)}/>
                &nbsp; Train routes
            </label>
            <label>
                <input type='number' min='0' max='10'
                    value={busRouteThreshold} onChange={e => setBusRouteThreshold(e.target.valueAsNumber)}/>
                &nbsp; Bus routes
            </label>
        </TreeNode>
        {stationElems}
    </TreeNode>;
}
