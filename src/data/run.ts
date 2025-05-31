import { Relation, Way } from './index';
import { Id, getSyntheticId, unpack } from './id';
import { getAsync, memCacheId } from '../util/overpass_cache';

export default class Run extends Relation {
    public static readonly forwardRole = 'forward';
    public static readonly reverseRole = 'reverse';
    public readonly role: string;

    public get firstNodeId(): Id | undefined {
        if (this.firstChildRef.role === Run.forwardRole) {
            return this.firstChild?.firstChildRef.id;
        } else {
            return this.firstChild?.lastChildRef.id;
        }
    }

    public get lastNodeId(): Id | undefined {
        if (this.lastChildRef.role === Run.forwardRole) {
            return this.lastChild?.lastChildRef.id;
        } else {
            return this.lastChild?.firstChildRef.id;
        }
    }

    public constructor(role: string) {
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

        this.role = role;
    }

    public tryAdd(way: Way): boolean {
        if (!way.firstChild || !way.lastChild
            || !this.firstChild?.firstChild || !this.lastChild?.lastChild) {
            return false;
        }

        const wayFirstNode = way.firstChild.id;
        const wayLastNode = way.lastChild.id;

        if (this.childRefs.length === 0) {
            this.addChild(way, Run.forwardRole);
        }
        else if (this.lastNodeId === wayFirstNode) {
            this.addChild(way, Run.forwardRole);
        }
        else if (this.firstNodeId === wayLastNode) {
            this.addChild(way, Run.forwardRole, 0);
        }
        else if (this.firstNodeId === wayFirstNode) {
            // TODO: reverse way rendering
            this.addChild(way, Run.reverseRole, 0);
        }
        else if (this.lastNodeId === wayLastNode) {
            // TODO: reverse way rendering
            this.addChild(way, Run.reverseRole);
        }
        else {
            return false;
        }

        return true;
    }

    public static async generateFromRelation(relation: Relation): Promise<Run[]> {
        const existingRuns = relation.childrenOfType(Run);
        if (existingRuns.length > 0) {
            return existingRuns;
        }

        let wayRefs = relation.childRefsOfType(Way);
        if (wayRefs.length === 0) {
            await getAsync(relation.childRefsOfType('way').map(ref => ref.id));
            wayRefs = relation.childRefsOfType(Way);
        }

        const runs: Run[] = [];

        for (const wayRef of wayRefs) {
            const wayEnds = [wayRef.element.firstChild?.id, wayRef.element.lastChild?.id];
            if (wayEnds.some(id => id === undefined)) {
                continue;
            }

            // The list of known way groups that successfully added the way 
            const added = relation.childrenOfType(Run).filter(r => r.role === wayRef.role && r.tryAdd(wayRef.element));

            // no existing way group will take it, add a new one
            if (added.length === 0) {
                const r = new Run(wayRef.role!);
                r.addParent(relation, 'run');
                r.addChild(wayRef.element, Run.forwardRole);
                continue;
            }

            // check if the new run bridged two existing runs
            for (let i = 0; i < added.length - 1; i++) {
                // the older of the two runs
                const senior = added[i];
                const seniorEndWays = [
                    senior.firstChildRef.id,
                    senior.lastChildRef.id,
                ];
                const junior = added.slice(i + 1).find(r => {
                    return seniorEndWays.includes(r.firstChildRef.id)
                        || seniorEndWays.includes(r.lastChildRef.id);
                });

                if (!junior) {
                    continue;
                }

                const seniorStart = wayEnds.indexOf(senior.firstNodeId);
                const seniorEnd = wayEnds.indexOf(senior.lastNodeId);
                const juniorStart = wayEnds.indexOf(junior.firstNodeId);
                const juniorEnd = wayEnds.indexOf(junior.lastNodeId);

                let newChildren: Way[];
                // append forward
                if (seniorEnd >= 0 && juniorStart >= 0 && seniorEnd !== juniorStart
                    // prepend reverse
                    || seniorStart >= 0 && juniorStart >= 0 && seniorStart !== juniorStart
                ) {
                    newChildren = junior.childrenOfType(Way).slice(1);
                }
                // prepend forward
                else if (seniorStart >= 0 && juniorEnd >= 0 && seniorStart !== juniorEnd
                    // append reverse
                    || seniorEnd >= 0 && juniorEnd >= 0 && seniorEnd !== juniorEnd
                ) {
                    newChildren = junior.childrenOfType(Way).reverse().slice(1);
                }
                else {
                    console.error('How did we get here?');
                    continue;
                }

                for (const w of newChildren) {
                    if (!senior.tryAdd(w)) {
                        throw new Error(`Failed to add way ${w.id} to run`);
                    }
                }

                junior.orphan();
            }
        }

        for (const r of runs) {
            memCacheId.set(r.id, r);
        }

        return runs;
    }
}
