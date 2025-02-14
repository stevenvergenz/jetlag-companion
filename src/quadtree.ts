import { LatLngTuple } from 'leaflet';

/** Quatral search tree */
export class RTree {
    private readonly root: Node;

    public constructor(points: LatLngTuple[]) {
        this.root = new Node(points);
    }

    public findIntersection(other: RTree): LatLngTuple {
        const queue = new Queue<[LatLngTuple | Node, LatLngTuple | Node]>();
        queue.push([this.root, other.root], Infinity);
        
        const intersectPoints = [] as LatLngTuple[];
        while (!queue.isEmpty() && intersectPoints.length < 4) {
            const [a, b] = queue.pop()!;
            if (a instanceof Node && b instanceof Node) {
                
            }
            else {
                intersectPoints.push(a as LatLngTuple);
                intersectPoints.push(b as LatLngTuple);
            }
        }

        return [
            intersectPoints.map(p => p[0]).reduce((a, b) => a + b) / intersectPoints.length,
            intersectPoints.map(p => p[1]).reduce((a, b) => a + b) / intersectPoints.length,
        ];
    }

    public findNearest(point: LatLngTuple, count: number): LatLngTuple[] {
        const queue = new Queue<LatLngTuple | Node>();
        queue.push(this.root, Infinity);

        const ret = [] as LatLngTuple[];
        while (!queue.isEmpty() && ret.length < count) {
            const node = queue.pop()!;
            if (node instanceof Node) {
                for (const p of node.points) {
                    queue.push(p, Math.hypot(p[0] - point[0], p[1] - point[1]));
                }
                for (const r of node.regions) {
                    queue.push(r, r.bounds.distance(point));
                }
            } else {
                ret.push(node);
            }
        }
        return ret;
    }

}

class Node {
    public readonly bounds: Bounds;
    public readonly regions: Node[];
    public readonly points: LatLngTuple[];

    public constructor(points: LatLngTuple[]) {
        if (points.length < 10) {
            this.points = points;
            this.regions = [];
            this.bounds = new Bounds(points);
        } else {
            this.regions = [
                new Node(points.slice(0, points.length / 2)),
                new Node(points.slice(points.length / 2)),
            ];
            this.points = [];
            this.bounds = this.regions.reduce((b, r) => b.union(r.bounds), new Bounds([]));
        }
    }
}

class Queue<T> {
    private readonly queue: [T, number][] = [];

    public push(node: T, priority: number) {
        for (let i = 0; i < this.queue.length; i++) {
            if (priority < this.queue[i][1]) {
                this.queue.splice(i, 0, [node, priority]);
                return;
            }
        }
        this.queue.push([node, priority]);
    }

    public pop(): T | undefined {
        return this.queue.shift()?.[0];
    }

    public isEmpty(): boolean {
        return this.queue.length === 0;
    }
}

class Bounds {
    private latMin = Infinity;
    private latMax = -Infinity;
    private lonMin = Infinity;
    private lonMax = -Infinity;

    public constructor(points: LatLngTuple[]) {
        for (const [lat, lon] of points) {
            this.latMin = Math.min(this.latMin, lat);
            this.latMax = Math.max(this.latMax, lat);
            this.lonMin = Math.min(this.lonMin, lon);
            this.lonMax = Math.max(this.lonMax, lon);
        }
    }

    public isValid(): boolean {
        return this.latMin <= this.latMax && this.lonMin <= this.lonMax;
    }

    public contains(point: LatLngTuple): boolean {
        return this.latMin <= point[0] && point[0] <= this.latMax
            && this.lonMin <= point[1] && point[1] <= this.lonMax;
    }

    public distance(point: LatLngTuple): number {
        if (!this.isValid()) {
            return NaN;
        }
        else if (this.contains(point)) {
            return 0;
        }
        else if (point[0] > this.latMax) {
            if (point[1] < this.lonMin) {
                return Math.hypot(point[0] - this.latMax, point[1] - this.lonMin);
            }
            else if (point[1] > this.lonMax) {
                return Math.hypot(point[0] - this.latMax, point[1] - this.lonMax);
            }
            else {
                return Math.abs(point[0] - this.latMax);
            }
        }
        else if (point[0] < this.latMin) {
            if (point[1] < this.lonMin) {
                return Math.hypot(point[0] - this.latMin, point[1] - this.lonMin);
            }
            else if (point[1] > this.lonMax) {
                return Math.hypot(point[0] - this.latMin, point[1] - this.lonMax);
            }
            else {
                return Math.abs(point[0] - this.latMin);
            }
        }
        else {
            if (point[1] < this.lonMin) {
                return Math.abs(point[1] - this.lonMin);
            } else {
                return Math.abs(point[1] - this.lonMax);
            }
        }
    }

    public area(): number {
        if (!this.isValid()) {
            return NaN;
        }
        return Math.abs(this.latMax - this.latMin) * Math.abs(this.lonMax - this.lonMin);
    }

    public intersection(other: Bounds): Bounds {
        const latMin = Math.max(this.latMin, other.latMin);
        const latMax = Math.min(this.latMax, other.latMax);
        const lonMin = Math.max(this.lonMin, other.lonMin);
        const lonMax = Math.min(this.lonMax, other.lonMax);
        return new Bounds([[latMin, lonMin], [latMax, lonMax]]);
    }

    public union(other: Bounds): Bounds {
        const latMin = Math.min(this.latMin, other.latMin);
        const latMax = Math.max(this.latMax, other.latMax);
        const lonMin = Math.min(this.lonMin, other.lonMin);
        const lonMax = Math.max(this.lonMax, other.lonMax);
        return new Bounds([[latMin, lonMin], [latMax, lonMax]]);
    }
}