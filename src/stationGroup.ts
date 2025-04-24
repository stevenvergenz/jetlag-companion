import { Id } from './id';
import { Element, Relation, Way, Node } from './element';

export default class StationGroup {
    private static findUp<T extends Element>(tag: string, es: Map<Id, Element>): Map<Id, T> {
        return this.find(tag, [...es.values()].flatMap(e => e.parents));
    }
    
    private static findDown<T extends Element>(tag: string, es: Map<Id, Element>): Map<Id, T> {
        return this.find(tag, [...es.values()].flatMap(e => e.children));
    }

    private static find<T extends Element>(tag: string, es: Element[]): Map<Id, T> {
        return es
            .filter(e => [e.data.tags?.public_transport, e.data.tags?.type].includes(tag))
            .reduce((map, e) => {
                map.set(e.id, e as T);
                return map;
            }, new Map<Id, T>());
    }

    public station?: Way | Node;
    public stopAreas: Map<Id, Relation> = new Map();
    public platforms: Map<Id, (Way | Node)> = new Map();
    public routes: Map<Id, Relation> = new Map();
    public routeMasters: Map<Id, Relation> = new Map();

    public get repId(): Id {
        return this.station?.id
            ?? this.stopAreas.values().next().value?.id
            ?? this.platforms.values().next().value!.id;
    }

    public get id(): Id {
        return `sg-${this.repId}`;
    }

    public get name(): string {
        return this.station?.name
            ?? this.stopAreas.values().next().value?.name
            ?? this.platforms.values().next().value!.name;
    }

    public get visuals(): (Way | Node)[] {
        return this.station ? [this.station] : [...this.platforms.values()];
    }

    public add(platform: Way | Node) {
        this.platforms.set(platform.id, platform);

        this.stopAreas = StationGroup.findUp<Relation>('stop_area', this.platforms);
        
        this.station = [...this.stopAreas.values()]
            .flatMap(s => s.children)
            .find(c => 
                (c instanceof Way || c instanceof Node) 
                && c.data.tags?.public_transport === 'station'
            ) as Way | Node | undefined;

        if (this.station) {
            this.stopAreas = StationGroup.findUp<Relation>('stop_area',
                new Map<Id, Element>([[this.station.id, this.station]]));
        }

        if (this.stopAreas.size > 0) {
            this.platforms = StationGroup.findDown('platform', this.stopAreas);
        }

        this.routes = StationGroup.findUp<Relation>('route', this.platforms);

        this.routeMasters = StationGroup.findUp<Relation>('route_master', this.routes);
    }

    public has(element: Element): boolean {
        return this.platforms.has(element.id)
            || this.stopAreas.has(element.id)
            || this.station?.id === element.id;
    }
}