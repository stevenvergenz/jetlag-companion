export type RoadSearchResult = {
    id: number,
    description: string,
    member_roles: string[],
};

export type RoadSearchResults = Map<number, RoadSearchResult>;

type OQueryResult = {
    version: string,
    generator: string,
    elements: OElement[],
};

type OItemType = 'relation' | 'way' | 'node';
type OCommon = {
    type: OItemType,
    id: number,
    members: OMember[],
    tags: { [key: string]: string },
};

type ORelation = OCommon & {
    type: 'relation',
};

type OMember = {
    type: OItemType,
    ref: number,
    role?: string,
}

type OElement = ORelation;

const ENDPOINT = 'https://overpass-api.de/api/interpreter';

export async function search_road(pattern: string): Promise<RoadSearchResults> {
    const query = `
        [out:json];
        relation
            [type=route]
            ["description" ~ "${pattern}"];
        out;
        `;

    const res = await fetch(ENDPOINT, { method: 'POST', body: query });
    const body = await res.json() as OQueryResult;
    return body.elements.reduce((map, r) => {
        map.set(r.id, {
            id: r.id,
            description: r.tags['description'],
            member_roles: [...new Set(r.members.map(m => m.role))],
        });
        return map;
    }, new Map());
}

export async function get_road_path(id: number) {
    const query = `
        [out:json];
        relation
            (${id});
        way(r);
        out;`;
}