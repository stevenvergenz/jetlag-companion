import { Id } from './data/index';

export type BoundaryConfig = {
    included: Set<Id>,
    excluded: Set<Id>,
};

export type StationConfig = {
    show: boolean,
    busRouteThreshold: number,
    trainRouteThreshold: number,
};

export type Config = {
    stations: StationConfig,
};

export type PartialConfig = {
    stations?: Partial<StationConfig>,
};

export const DefaultConfig: Config = {
    stations: {
        show: true,
        busRouteThreshold: 2,
        trainRouteThreshold: 1,
    },
}

export function load(): Config {
    const busRoutes = window.localStorage.getItem('stations_bus_routes');
    const trainRoutes = window.localStorage.getItem('stations_train_routes');
    return {
        stations: {
            show: window.localStorage.getItem('stations_show') === 'true',
            busRouteThreshold: busRoutes ? parseInt(busRoutes, 10) : DefaultConfig.stations.busRouteThreshold,
            trainRouteThreshold: trainRoutes ? parseInt(trainRoutes, 10) : DefaultConfig.stations.trainRouteThreshold,
        },
    };
}

export function save(config: Config) {
    window.localStorage.setItem('stations_show', config.stations.show.toString());
    window.localStorage.setItem('stations_bus_routes', config.stations.busRouteThreshold.toString());
    window.localStorage.setItem('stations_train_routes', config.stations.trainRouteThreshold.toString());
}