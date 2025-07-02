import { Position } from 'geojson';

export enum ZoneSize {
    SmallKm = 'SmallKm',
    LargeKm = 'LargeKm',
    SmallMi = 'SmallMi',
    LargeMi = 'LargeMi',
};

export type BoundaryConfig = {
    points: Position[],
};

export type StationConfig = {
    busRouteThreshold: number,
    trainRouteThreshold: number,
    zoneSize: ZoneSize,
};

export type Config = {
    boundary: BoundaryConfig,
    stations: StationConfig,
};

export type PartialConfig = {
    boundary?: Partial<BoundaryConfig>,
    stations?: Partial<StationConfig>,
};

export const DefaultConfig: Config = {
    boundary: {
        points: [],
    },
    stations: {
        busRouteThreshold: 2,
        trainRouteThreshold: 1,
        zoneSize: ZoneSize.SmallMi,
    },
};

export function load(): Config {
    const busRoutes = window.localStorage.getItem('stations_bus_routes');
    const trainRoutes = window.localStorage.getItem('stations_train_routes');
    return {
        boundary: {
            points: JSON.parse(window.localStorage.getItem('boundary_points') ?? '[]') as Position[],
        },
        stations: {
            busRouteThreshold: busRoutes ? parseInt(busRoutes, 10) : DefaultConfig.stations.busRouteThreshold,
            trainRouteThreshold: trainRoutes ? parseInt(trainRoutes, 10) : DefaultConfig.stations.trainRouteThreshold,
            zoneSize: window.localStorage.getItem('stations_zone_size') as ZoneSize ?? DefaultConfig.stations.zoneSize,
        },
    };
}

export function save(config: Config) {
    window.localStorage.setItem('boundary_points', JSON.stringify(config.boundary.points));
    window.localStorage.setItem('stations_bus_routes', config.stations.busRouteThreshold.toString());
    window.localStorage.setItem('stations_train_routes', config.stations.trainRouteThreshold.toString());
    window.localStorage.setItem('stations_zone_size', config.stations.zoneSize);
}

export function apply(config: Config, update: PartialConfig): Config {
    return {
        boundary: {
            points: update.boundary?.points ?? config.boundary.points,
        },
        stations: {
            busRouteThreshold: update.stations?.busRouteThreshold ?? config.stations.busRouteThreshold,
            trainRouteThreshold: update.stations?.trainRouteThreshold ?? config.stations.trainRouteThreshold,
            zoneSize: update.stations?.zoneSize ?? config.stations.zoneSize,
        },
    };
}