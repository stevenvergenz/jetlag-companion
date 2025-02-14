import { OsmElement, OsmElementType } from "./overpass_api";

export type Id = string;

export type IdUnpacked = {
    type: OsmElementType,
    id: number,
    offset?: number,
};

const idRegex = /^(r|wg|w|n):(\d+)(?:\/(\d+))?$/;
const typeMap: { [key: string]: OsmElementType } = {
    'r': 'relation',
    'wg': 'wayGroup',
    'w': 'way',
    'n': 'node',
};

export function unpack(id: string): IdUnpacked {
    const match = id.match(idRegex);
    if (!match) {
        throw new Error('Invalid key');
    }

    return {
        type: typeMap[match[1]],
        id: parseInt(match[2], 10),
        offset: match[3] ? parseInt(match[3], 10) : undefined
    };
}

export function pack(obj: IdUnpacked): Id {
    if (obj.offset) {
        return `${obj.type}:${obj.id}/${obj.offset}`;
    }
    else {
        return `${obj.type}:${obj.id}`;
    }
}

export function packFrom(data: OsmElement): Id {
    return pack({ type: data.type, id: data.id });
}