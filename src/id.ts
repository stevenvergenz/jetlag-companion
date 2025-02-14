import { OsmElement, OsmElementType } from "./overpass_api";

export type Id = string;

export type IdUnpacked = {
    type: OsmElementType,
    id: number,
    offset?: number,
    reverse?: boolean,
};

const idRegex = /^(-)?(r|wg|w|n):(\d+)(?:\/(\d+))?$/;
const typePrefixMap = new Map([
    ['r', 'relation' as OsmElementType],
    ['wg', 'wayGroup' as OsmElementType],
    ['w', 'way' as OsmElementType],
    ['n', 'node' as OsmElementType],
]);
const typePrefixReverseMap = [...typePrefixMap.entries()]
    .map(([k, v]) => [v, k])
    .reduce((map, [k, v]) => {
        map.set(k, v);
        return map;
    }, new Map<string, string>());

export function unpack(id: Id): IdUnpacked {
    const match = idRegex.exec(id);
    if (!match) {
        throw new Error(`Invalid key: ${id}`);
    }

    return {
        reverse: match[1] === '-',
        type: typePrefixMap.get(match[2])!,
        id: parseInt(match[3], 10),
        offset: match[3] ? parseInt(match[4], 10) : undefined
    };
}

export function pack(obj: IdUnpacked): Id {
    if (obj.offset !== undefined) {
        return `${obj.reverse ? '-' : ''}${typePrefixReverseMap.get(obj.type)}:${obj.id}/${obj.offset}`;
    }
    else {
        return `${obj.reverse ? '-' : ''}${typePrefixReverseMap.get(obj.type)}:${obj.id}`;
    }
}

export function packFrom(data: OsmElement): Id {
    return pack({ type: data.type, id: data.id });
}

export function reverse(id: Id): Id {
    if (id.startsWith('-')) {
        return id.slice(1);
    }
    else {
        return `-${id}`;
    }
}

export function isReversed(id: Id): boolean {
    return id.startsWith('-');
}

export function unreversed(id: Id): Id {
    return isReversed(id) ? id.slice(1) : id;
}