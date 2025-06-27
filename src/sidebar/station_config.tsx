import { ReactNode, useContext, useState } from 'react';

import { Id, unpack, Way, Node, Station } from '../data';
import { SharedContext } from '../context';
import { getByTransportTypeAsync, memCacheId } from '../util/overpass_cache';

export function StationConfig(): ReactNode {
    const {
        boundaryPoints,
        busRouteThreshold,
        trainRouteThreshold,
        stations, setStations,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);
    const [calcStarted, setCalcStarted] = useState(false);

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
        return <li>
            <a target='_blank' href={`https://www.openstreetmap.org/${type}/${id}`}
                onMouseEnter={hoverStart(station.childRefs[0].id)}
                onMouseLeave={hoverEnd(station.childRefs[0].id)}
            >
                {station.name}
            </a>
        </li>;
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

    if (stations.length === 0 && !calcStarted) {
        calcStations();
        return;
    }

    const s = stations.filter(s => s.shouldShow({ busRouteThreshold, trainRouteThreshold }))
        .map(s => genLabel(s))

    return <div>
        <h2>Station Criteria</h2>
        <p>
            Hide and seek "stations" are transit hubs that are important for your game.
            Set the criteria for which transit hubs you want to include.
            At least one of the criteria must be met.
        </p>
        <div className='grid grid-cols-2 gap-2'>
            <label>Train connections:</label>
            <input type='number' min={0} max={10} step={1}
                value={trainRouteThreshold} onChange={(e) => setTrainRouteThreshold(parseInt(e.target.value, 10))}
                />
            <label>Bus connections:</label>
            <input type='number' min={0} max={10} step={1}
                value={busRouteThreshold} onChange={(e) => setBusRouteThreshold(parseInt(e.target.value, 10))}
                />
        </div>
        <p>{s.length} stations found:</p>
        <ul>
            {s}
        </ul>
    </div>;
}
