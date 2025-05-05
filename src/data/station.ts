import { Id, getSyntheticId } from './id';
import Element from './element';
import Relation from './relation';
import Way from './way';
import Node from './node';
import { OsmRelation } from './overpass_api';

function findUp<T extends Element>(tag: string, es: Map<Id, Element>): Map<Id, T> {
    return find(tag, [...es.values()].flatMap(e => e.parents));
}

function findDown<T extends Element>(tag: string, es: Map<Id, Element>): Map<Id, T> {
    return find(tag, [...es.values()].flatMap(e => e.children));
}

function find<T extends Element>(tag: string, es: Element[]): Map<Id, T> {
    return es
        .filter(e => [e.data.tags?.public_transport, e.data.tags?.type].includes(tag))
        .reduce((map, e) => {
            map.set(e.id, e as T);
            return map;
        }, new Map<Id, T>());
}

export default class Station extends Relation {
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

        this.stopAreas = findUp<Relation>('stop_area', this.platforms);
        
        this.station = [...this.stopAreas.values()]
            .flatMap(s => s.children)
            .find(c => 
                (c instanceof Way || c instanceof Node) 
                && c.data.tags?.public_transport === 'station'
            ) as Way | Node | undefined;

        if (this.station) {
            this.stopAreas = findUp<Relation>('stop_area',
                new Map<Id, Element>([[this.station.id, this.station]]));
        }

        if (this.stopAreas.size > 0) {
            this.platforms = findDown('platform', this.stopAreas);
        }

        this.routes = findUp<Relation>('route', this.platforms);

        this.routeMasters = findUp<Relation>('route_master', this.routes);
    }

    public has(element: Element): boolean {
        return this.platforms.has(element.id)
            || this.stopAreas.has(element.id)
            || this.station?.id === element.id;
    }

    public save(): Relation {
        const data: OsmRelation = {
            id: 252525,
            type: 'relation',
            members: [],
        };

        if (this.station) {
            data.members.push({
                ref: this.station.data.id,
                type: this.station.data.type,
                role: 'station',
            });
        }

        for (const p of this.platforms.values()) {
            data.members.push({
                ref: p.data.id,
                type: p.data.type,
                role: 'platform',
            });
        }

        for (const s of this.stopAreas.values()) {
            data.members.push({
                ref: s.data.id,
                type: s.data.type,
                role: 'stop_area',
            });
        }

        for (const r of this.routes.values()) {
            data.members.push({
                ref: r.data.id,
                type: r.data.type,
                role: 'route',
            });
        }

        for (const rm of this.routeMasters.values()) {
            data.members.push({
                ref: rm.data.id,
                type: rm.data.type,
                role: 'route_master',
            });
        }
        
        return new Relation(this.id, data);
    }
}