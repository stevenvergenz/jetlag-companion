import { ReactNode, useEffect, useContext } from 'react';
import { CircleMarker, LayerGroup, FeatureGroup, Polygon, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { Id, unpack } from './id';
import { TreeNode } from './tree_node';
import { SharedContext } from './context';
import { getByTransportTypeAsync } from './overpass_cache';
import { Way, Node } from './element';
import StationGroup from './station_group';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.8,
};

const busTypes = ['bus', 'trolleybus', 'tram'];
const trainTypes = ['train', 'subway', 'monorail', 'light_rail'];

export function StationConfig(): ReactNode {
    const {
        showStations,
        busRouteThreshold,
        trainRouteThreshold,
        stations,
        hovering, setHovering,
        save,
    } = useContext(SharedContext);

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
    
    function genLabel(station: StationGroup) {
        const { type, id } = unpack(station.repId);
        return <label>
            {station.name} (
            <a target='_blank' href={`https://www.openstreetmap.org/${type}/${id}`}>{station.repId}</a>
            )
        </label>;
    }

    function hoverEnd(id: Id) {
        return () => {
            if (hovering === id) {
                setHovering('');
            }
        };
    }

    const stationElems = stations.map(s => {
        return <TreeNode id={s.id} key={s.id} initiallyOpen={true}
            onMouseEnter={setHovering(s.id)} onMounseLeave={hoverEnd(s.id)} >
            {genLabel(s)}
        </TreeNode>;
    });

    return <TreeNode id='stations' initiallyOpen={true}>
        <label className='font-bold'>
            <input type='checkbox' checked={showStations} onChange={e => setShowStations(e.target.checked)} />
            &nbsp; Stations ({stations.length})
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

function shouldShow(
    station: StationGroup,
    { busRouteThreshold, trainRouteThreshold }: { busRouteThreshold: number, trainRouteThreshold: number },
): boolean {
    // total route masters to this station
    const types = new Map<string, number>();

    for (const rm of station.routeMasters.values()) {
        const type = rm.data.tags!.route_master;
        types.set(type, (types.get(type) ?? 0) + 1);
    }

    // total unmastered routes to this station
    for (const r of station.routes.values()) {
        if (r.parentIds.size > 0) {
            console.warn(`[station] ${r.id} has parent ids, but is not a route master`);
            continue;
        }
        const type = r.data.tags!.route;
        types.set(type, (types.get(type) ?? 0) + 0.5);
    }

    const otherTypes = [...types.keys()].filter(t => !busTypes.includes(t) && !trainTypes.includes(t));

    return busRouteThreshold > 0 && busRouteThreshold <=
        busTypes.map(t => types.get(t) ?? 0).reduce((a, b) => a + b)
    || trainRouteThreshold > 0 && trainRouteThreshold <=
        trainTypes.map(t => types.get(t) ?? 0).reduce((a, b) => a + b)
    || otherTypes.length > 0;
}

export function StationMarkers(): ReactNode {
    const {
        boundaryEditing, boundaryPath,
        showStations, busRouteThreshold, trainRouteThreshold,
        stations, setStations,
    } = useContext(SharedContext);

    useEffect(() => {
        async function helper() {
            if (!boundaryPath || boundaryPath.length < 2) { return; }

            const platforms = await getByTransportTypeAsync<Way | Node>(
                boundaryPath, 
                'platform',
                { request: true },
            );
            console.log(`[station] ${platforms.length} platforms found`);

            const tempStations = [] as StationGroup[];
            for (const platform of platforms) {
                let station = tempStations.find(s => s.has(platform));
                if (!station) {
                    station = new StationGroup();
                    tempStations.push(station);
                }
                station.add(platform);
            }
            console.log(`[station] ${tempStations.length} stations found`);

            setStations(tempStations.filter(s => shouldShow(s, { busRouteThreshold, trainRouteThreshold })));
        }
        helper();
    }, [boundaryPath, busRouteThreshold, trainRouteThreshold, setStations]);

    function modeString(station: StationGroup): ReactNode {
        const modes = [] as string[];

        if (station.station) {
            modes.push('Station');
        }

        if ([...station.platforms.values()].some(p => p.data.tags?.railway === 'platform')) {
            const routeStr = [...station.routeMasters.values()]
                .filter(rm => trainTypes.includes(rm.data.tags!.route_master))
                .map(r => r.data.tags?.ref)
                .join(', ');
            modes.push(`Rail (${routeStr})`);
        }

        if ([...station.platforms.values()].some(p => p.data.tags?.highway === 'bus_stop')) {
            const routeStr = [...station.routeMasters.values()]
                .filter(rm => busTypes.includes(rm.data.tags!.route_master))
                .map(r => r.data.tags?.ref)
                .join(', ');
            modes.push(`Bus (${routeStr})`);
        }

        return modes.map(m => <p key={`${station.id}-${m}`}>{m}</p>);
    }

    function renderStation(station: StationGroup): ReactNode {
        const visuals = [] as ReactNode[];
        for (const v of station.visuals) {
            if (v instanceof Way) {
                visuals.push(<Polygon key={v.id}
                    positions={v.children.map(c => [c.lat, c.lon])}
                    pathOptions={StationStyle}>
                </Polygon>);
            }
            else if (v instanceof Node) {
                visuals.push(<CircleMarker key={v.id}
                    center={[v.lat, v.lon]}
                    radius={5}
                    pathOptions={StationStyle}>
                </CircleMarker>);
            }
        }
        
        return <FeatureGroup key={station.id}>
            {visuals}
            <Tooltip>
                <p className='font-bold'>{station.name}</p>
                {modeString(station)}
            </Tooltip>
        </FeatureGroup>;
    }

    const s = stations.map(s => renderStation(s));
    console.log(`[station] ${s.length} stations to show`);
    if (boundaryPath && !boundaryEditing && showStations) {
        return <LayerGroup>
            {s}
        </LayerGroup>;
    }
}