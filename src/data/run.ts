import Relation from './relation';
import Way from './way';
import { getSyntheticId, unpack } from './id';
import { OsmElement } from './overpass_api';

export default class Run extends Relation {
    public static isRun(e: OsmElement): boolean {
        return e.type === 'relation' && e.tags?.jetlag_synthetic === 'run';
    }

    public constructor() {
        const id = getSyntheticId('relation');
        const uid = unpack(id);
        super(id, {
            id: uid.id,
            type: 'relation',
            tags: {
                jetlag_synthetic: 'run',
            },
            members: [],
        });
    }

    public tryAdd(way: Way): boolean {
        if (!way.firstChild || !way.lastChild
            || !this.firstChild?.firstChild || !this.lastChild?.lastChild) {
            return false;
        }

        const wayFirstNode = way.firstChild.id;
        const wayLastNode = way.lastChild.id;
        const runFirstNode = this.firstChild.firstChild.id;
        const runLastNode = this.lastChild.lastChild.id;

        if (this.children.length === 0) {
            this.addChild(way);
        }
        else if (runLastNode === wayFirstNode) {
            this.addChild(way);
        }
        else if (runFirstNode === wayLastNode) {
            this.addChild(way, undefined, 0);
        }
        else if (runFirstNode === wayFirstNode) {
            // TODO: reverse way rendering
            this.addChild(way, 'reversed', 0);
        }
        else if (runLastNode === wayLastNode) {
            // TODO: reverse way rendering
            this.addChild(way, 'reversed');
        }
        else {
            return false;
        }

        return true;
    }


    public static generateFromRelation(relation: Relation): Run[] {
        const runs: Run[] = [];

        const ways = relation.children.flatMap(ref => ref.element && Way.isWay(ref.element) ? [ref.element] : []);
        for (const way of ways) {
            
        }

        return runs;
        /*
        public static fulfillInterestRelationWay(child: Way, parent: Relation) {
            console.log(`[graph] checking groups with ${child.id} for ${parent.id}`);
            // All roles for the fulfilled way
            const roles = new Set(parent.data.members
                .filter(m => packFrom(m) === child.id)
                .map(m => m.role));
            if (roles.size === 0) {
                return;
            }

            const wayEnds = [child.childIds[0], child.childIds[child.childIds.length - 1]];

            for (const role of roles) {
                // The list of known way groups that successfully added the fulfilled way 
                const added = [...parent.wayGroups!.values()]
                    .filter(e => e.role === role && e.add(child));

                // no existing way group will take it, add a new one
                if (added.length === 0) {
                    WayGroup.fromWays(parent.id, role, child);
                    continue;
                }

                // check if the new way bridged two existing way groups
                for (let i = 0; i < added.length - 1; i++) {
                    // The older of two way groups
                    const senior = added[i];
                    const seniorEndWays = [
                        unreversed(senior.childIds[0]), 
                        unreversed(senior.childIds[senior.childIds.length - 1]),
                    ];
                    const junior = added.slice(i+1).find(wg => {
                        return seniorEndWays.includes(unreversed(wg.childIds[0]))
                            || seniorEndWays.includes(unreversed(wg.childIds[wg.childIds.length - 1]));
                    });

                    if (!junior) {
                        continue;
                    }

                    const seniorStart = wayEnds.indexOf(senior.startsWithNode);
                    const seniorEnd = wayEnds.indexOf(senior.endsWithNode);
                    const juniorStart = wayEnds.indexOf(junior.startsWithNode);
                    const juniorEnd = wayEnds.indexOf(junior.endsWithNode);

                    // append forward
                    if (seniorEnd >= 0 && juniorStart >= 0 && seniorEnd !== juniorStart) {
                        senior.childIds.push(...junior.childIds.slice(1));
                        senior.endsWithNode = junior.endsWithNode;
                    }
                    // prepend forward
                    else if (seniorStart >= 0 && juniorEnd >= 0 && seniorStart !== juniorEnd) {
                        senior.childIds.unshift(...junior.childIds.slice(0, -1));
                        senior.startsWithNode = junior.startsWithNode;
                    }
                    // append reverse
                    else if (seniorEnd >= 0 && juniorEnd >= 0 && seniorEnd !== juniorEnd) {
                        senior.childIds.push(...junior.childIds.reverse().map(w => reverse(w)).slice(1));
                        senior.endsWithNode = junior.startsWithNode;
                    }
                    // prepend reverse
                    else if (seniorStart >= 0 && juniorStart >= 0 && seniorStart !== juniorStart) {
                        senior.childIds.unshift(...junior.childIds.reverse().map(w => reverse(w)).slice(0, -1));
                        senior.startsWithNode = junior.endsWithNode;
                    }
                    else {
                        console.error('How did we get here?');
                        continue;
                    }

                    parent.wayGroups!.delete(junior.id);
                    parent.childIds = parent.childIds.filter(id => id !== junior.id);
                    
                    for (const way of junior.children) {
                        way.parentIds.delete(junior.id);
                        way.parentIds.add(senior.id);
                    }
                }
            }
        }
        */
    }
}
