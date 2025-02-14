import { Id, pack } from './id';

export type BoundaryConfig = {
    included: Set<Id>,
    excluded: Set<Id>,
};

export type StationConfig = {
    show: boolean,
    useTransitStations: boolean,
};

export type Config = {
    boundary: BoundaryConfig,
    stations: StationConfig,
};

const DefaultConfig: Config = {
    boundary: {
        included: new Set(),
        excluded: new Set(),
    },
    stations: {
        show: true,
        useTransitStations: true,
    },
}

export function load(): Config {
    const [bi, be] = ['boundary_included', 'boundary_excluded']
        .map(key => {
            const stored = window.localStorage.getItem(key);
            if (stored) {
                const data = JSON.parse(stored)
                    .map((id: number | string) => {
                        // port old numeric format to new string ids
                        if (typeof(id) === 'number') {
                            return pack({ type: 'relation', id });
                        } else {
                            return id;
                        }
                    });
                return new Set<Id>(data);
            } else {
                return undefined;
            }
        });
            
    return {
        boundary: {
            included: bi ?? DefaultConfig.boundary.included,
            excluded: be ?? DefaultConfig.boundary.excluded,
        },
        stations: {
            show: window.localStorage.getItem('stations_show') === 'true',
            useTransitStations: window.localStorage.getItem('stations_use_transit') === 'true',
        },
    };
}

export function save(config: Config) {
    window.localStorage.setItem('boundary_included', JSON.stringify([...config.boundary.included]));
    window.localStorage.setItem('boundary_excluded', JSON.stringify([...config.boundary.excluded]));
    window.localStorage.setItem('stations_show', config.stations.show.toString());
    window.localStorage.setItem('stations_use_transit', config.stations.useTransitStations.toString());
}