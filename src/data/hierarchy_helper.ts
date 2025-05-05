import { Id, packFrom, reverse, unreversed } from './id';
import Element from './element';
import Relation from './relation';
import Way from './way';

export default class HierarchyHelper {
    private static interests = new Map<Id, Set<Id>>();

    public static reset() {
        this.interests = new Map();
    }

    public static setInterest(childId: Id, parent: Element) {
        parent.addChildUnique(childId);
        const knownChild = get(childId);
        if (knownChild) {
            //console.log(`[graph] ${parent.id} is interested in ${childId} (known)`);
            this.fulfillInterest(knownChild, parent);
        }
        else if (this.interests.has(childId)) {
            //console.log(`[graph] ${parent.id} is interested in ${childId}`);
            this.interests.get(childId)!.add(parent.id);
        }
        else {
            //console.log(`[graph] ${parent.id} is interested in ${childId}`);
            this.interests.set(childId, new Set([parent.id]));
        }
    }

    public static fulfillInterests(child: Element) {
        const interests = this.interests.get(child.id);
        //console.log(`[graph] fulfilling ${interests?.size ?? 0} interests for ${child.id}`);
        for (const rid of interests ?? []) {
            const r = get(rid);
            if (r) {
                this.fulfillInterest(child, r);
            } else {
                console.error(`[graph] missing parent ${rid} for ${child.id}`);
            }
        }
        this.interests.delete(child.id);
    }

    public static fulfillInterest(child: Element, parent: Element) {
        //console.log(`[graph] fulfilling interest: ${child.id} -> ${parent.id}, ${this.interests.get(parent.id)?.size ?? 0} remaining`);
        child.parentIds.add(parent.id);
    }

    public static fulfillInterestRelationWay(child: Way, parent: Relation) {
        console.log(`[graph] checking groups with ${child.id} for ${parent.id}`);
        /** All roles for the fulfilled way */
        const roles = new Set(parent.data.members
            .filter(m => packFrom(m) === child.id)
            .map(m => m.role));
        if (roles.size === 0) {
            return;
        }

        const wayEnds = [child.childIds[0], child.childIds[child.childIds.length - 1]];

        for (const role of roles) {
            /** The list of known way groups that successfully added the fulfilled way */
            const added = [...parent.wayGroups!.values()]
                .filter(e => e.role === role && e.add(child));

            // no existing way group will take it, add a new one
            if (added.length === 0) {
                WayGroup.fromWays(parent.id, role, child);
                continue;
            }

            // check if the new way bridged two existing way groups
            for (let i = 0; i < added.length - 1; i++) {
                /** The older of two way groups */
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
}
