import { Path } from 'leaflet';

export function onHover(map: google.maps.Map | null, featureIds: number[] | undefined) {
    return () => {
        if (!map || !featureIds) { return; }
        for (const id of featureIds) {
            const f = map.data.getFeatureById(id);
            if (!f) { continue;}
            f.setProperty('highlightCount', (f.getProperty('highlightCount') as number ?? 0) + 1);
        }
    }
}

export function onUnhover(map: google.maps.Map | null, featureIds: number[] | undefined) {
    return () => {
        if (!map || !featureIds) { return; }
        for (const id of featureIds) {
            const f = map.data.getFeatureById(id);
            if (!f) { continue;}
            f.setProperty('highlightCount', (f.getProperty('highlightCount') as number ?? 1) - 1);
        }
    }
}

export function setupHover() {
    function onHover(path: Path) {
        path.setStyle({ stroke: true, weight: 10, color: 'red' });
    }
    function onUnhover(path: Path, enabled: boolean) {
        path.setStyle({ stroke: enabled, weight: 3, color: 'black' });
    }
    return [onHover, onUnhover];
}