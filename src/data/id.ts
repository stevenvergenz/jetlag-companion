import { OsmElementType } from "./overpass_api";

export type Id = string;

export type IdUnpacked = {
    type: OsmElementType,
    id: number,
};

const idRegex = /^(r|w|n):(-?\d+)(?:\/(\d+))?$/;
const typePrefixMap = new Map<string, OsmElementType>([
    ['r', 'relation'],
    ['w', 'way'],
    ['n', 'node'],
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
        type: typePrefixMap.get(match[1])!,
        id: parseInt(match[2], 10),
    };
}

export function pack(obj: IdUnpacked): Id {
    return `${typePrefixReverseMap.get(obj.type)}:${obj.id}`;
}

export function packFrom({ type, id, ref }: { type: OsmElementType, id?: number, ref?: number}): Id {
    if (id === undefined && ref === undefined) {
        throw new Error('id or ref must be defined');
    }
    return pack({ type, id: (id ?? ref)! });
}

let nextSyntheticId = -1;

export function getSyntheticId(type: OsmElementType): Id {
    return pack({ id: nextSyntheticId--, type });
}

export function updateSyntheticId(id: Id) {
    const unpacked = unpack(id);
    nextSyntheticId = Math.min(nextSyntheticId, unpacked.id - 1);
}

export function resetSyntheticIdCounter() {
    nextSyntheticId = -1;
}