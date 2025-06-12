import { ReactNode, useContext } from 'react';
import { CircleMarker, LayerGroup, FeatureGroup, Polygon, Tooltip } from 'react-leaflet';
import { PathOptions } from 'leaflet';

import { Id, unpack, Element, Relation, Way, Node, Station } from './data/index';
import { TreeNode } from './util/tree_node';
import { SharedContext } from './context';
import { getByTransportTypeAsync, memCacheId } from './util/overpass_cache';

const StationStyle: PathOptions = {
    color: '#3388ff',
    weight: 2,
    fillOpacity: 0.8,
};

const HoverStyle: PathOptions = {
    ...StationStyle,
    color: '#ff0000',
};

const busTypes = ['bus', 'trolleybus', 'tram'];
const trainTypes = ['train', 'subway', 'monorail', 'light_rail'];


function shouldShow(
    station: Station,
    { busRouteThreshold, trainRouteThreshold }: { busRouteThreshold: number, trainRouteThreshold: number },
): boolean {
    // total route masters to this station
    const types = new Map<string, number>();

    for (const rm of station.allElementsWithRole('route_master', Relation)) {
        const type = rm.data.tags!.route_master;
        types.set(type, (types.get(type) ?? 0) + 1);
    }

    // total unmastered routes to this station
    for (const r of station.allElementsWithRole('route', Relation)) {
        const type = r.data.tags!.route;
        types.set(type, (types.get(type) ?? 0) + 0.5);
    }

    //console.log(`${station.id}: ${JSON.stringify(types)}`);

    const otherTypes = [...types.keys()].filter(t => !busTypes.includes(t) && !trainTypes.includes(t));

    return busRouteThreshold > 0 && busRouteThreshold <=
        busTypes.map(t => types.get(t) ?? 0).reduce((a, b) => a + b)
    || trainRouteThreshold > 0 && trainRouteThreshold <=
        trainTypes.map(t => types.get(t) ?? 0).reduce((a, b) => a + b)
    || otherTypes.length > 0;
}

export function StationConfig(): ReactNode {
    const {
        boundaryPath,
        showStations,
        busRouteThreshold,
        trainRouteThreshold,
        stations, setStations,
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
    
    function genLabel(station: Station) {
        const { type, id } = unpack(station.childRefs[0].id);
        return <label>
            {station.name} (
            <a target='_blank' href={`https://www.openstreetmap.org/${type}/${id}`}>{station.childRefs[0].id}</a>
            )
        </label>;
    }

    async function calcStations() {
        if (!boundaryPath || boundaryPath.length < 2) {
            return;
        }

        const platforms = await getByTransportTypeAsync<Way | Node>(
            boundaryPath, 
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

    function hoverEnd(id: Id) {
        return () => {
            if (hovering === id) {
                setHovering('');
            }
        };
    }

    if (stations.length === 0) {
        calcStations();
        return;
    }

    const stationElems = stations
        .filter(s => shouldShow(s, { busRouteThreshold, trainRouteThreshold }))
        .map(s => {
            return <TreeNode id={s.id} key={s.id} initiallyOpen={true}
                onMouseEnter={() => setHovering(s.id)} onMouseLeave={hoverEnd(s.id)} >
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

export function StationMarkers(): ReactNode {
    const {
        boundaryEditing, boundaryPath,
        hovering,
        showStations, busRouteThreshold, trainRouteThreshold,
        stations,
    } = useContext(SharedContext);

    function modeString(station: Station): ReactNode {
        const modes = [] as string[];

        if (station.childRefs[0].role === 'station') {
            modes.push('Station');
        }

        if (station.allElementsWithRole('platform', Element).some(p => p.data.tags?.railway === 'platform')) {
            const routeStr = station.allElementsWithRole('route_master', Relation)
                .filter(rm => trainTypes.includes(rm.data.tags!.route_master))
                .map(r => r.data.tags?.ref)
                .join(', ');
            modes.push(`Rail (${routeStr})`);
        }

        if (station.allElementsWithRole('platform', Element).some(p => p.data.tags?.highway === 'bus_stop')) {
            const routeStr = station.allElementsWithRole('route_master', Relation)
                .filter(rm => busTypes.includes(rm.data.tags!.route_master))
                .map(r => r.data.tags?.ref)
                .join(', ');
            modes.push(`Bus (${routeStr})`);
        }

        return modes.map(m => <p key={`${station.id}-${m}`}>{m}</p>);
    }

    function renderStation(station: Station): ReactNode {
        const visuals = [] as ReactNode[];
        for (const v of station.visuals) {
            if (v instanceof Way) {
                visuals.push(<Polygon key={v.id}
                    positions={v.childrenOfType(Node).map(c => [c.lat, c.lon])}
                    pathOptions={hovering === station.id ? HoverStyle : StationStyle}>
                </Polygon>);
            }
            else if (v instanceof Node) {
                const circle = 
                    <CircleMarker key={v.id}
                        center={[v.lat, v.lon]}
                        radius={5}
                        
                        pathOptions={hovering === station.id ? HoverStyle : StationStyle}
                        eventHandlers={{click: () => console.log(station)}}>
                    </CircleMarker>;

                visuals.push(circle);
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

    const s = stations
        .filter(s => shouldShow(s, { busRouteThreshold, trainRouteThreshold }))
        .map(s => renderStation(s));
    console.log(`[station] ${s.length} stations to show`);
    if (boundaryPath && !boundaryEditing && showStations) {
        return <LayerGroup>
            {s}
        </LayerGroup>;
    }
}