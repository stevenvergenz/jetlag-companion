import { LatLngTuple } from 'leaflet';
import { Vec2 } from './boundary_loop';

/** Quatral search tree */
export class RTree {
    private static distanceFn(a: LatLngTuple, b: LatLngTuple): number {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

    private readonly root: Node;

    public constructor(points: LatLngTuple[]) {
        this.root = new Node(points);
    }

    public findIntersection(other: RTree): LatLngTuple {
        const queue = new Queue<[LatLngTuple | Node, LatLngTuple | Node]>();
        queue.push([this.root, other.root], -Infinity);
        
        const intersectPoints = [] as LatLngTuple[];
        while (!queue.isEmpty() && intersectPoints.length < 4) {
            const [a, b] = queue.pop()!;
            if (a instanceof Node && b instanceof Node) {
                const overlap = a.bounds.intersection(b.bounds);

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

    public distance(point: LatLngTuple, distanceFn = RTree.distanceFn): number {
        const queue = new Queue<LatLngTuple | Node>();
        queue.push(this.root, Infinity);

        const nearPoints = [] as LatLngTuple[];
        while (!queue.isEmpty() && nearPoints.length < 2) {
            const node = queue.pop()!;
            if (node instanceof Node) {
                for (const p of node.points) {
                    queue.push(p, distanceFn(p, point));
                }
                for (const r of node.regions) {
                    queue.push(r, r.bounds.distance(point, distanceFn));
                }
            } else {
                nearPoints.push(node);
            }
        }
        
        const pathVec = Vec2.sub(nearPoints[0], nearPoints[1]);
        const pointVec = Vec2.sub(nearPoints[0], point);
        const dot = Vec2.dot(pathVec, pointVec);
        if (dot < 0) {
            return Vec2.length(Vec2.sub(nearPoints[0], point));
        } else {
            return dot;
        }
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

    public evaluateIntersection(
        other: Node, queue: Queue<[LatLngTuple | Node, LatLngTuple | Node]>
    ) {
        const overlap = this.bounds.intersection(other.bounds);
        const mine = [
            ...this.regions.filter(r => r.bounds.intersects(overlap)),
            ...this.points.filter(p => overlap.contains(p)),
        ];
        const theirs = [
            ...other.regions.filter(r => r.bounds.intersects(overlap)),
            ...other.points.filter(p => overlap.contains(p)),
        ];

        for (const m of mine) {
            for (const t of theirs) {
                if (m instanceof Node) {
                    if (t instanceof Node && m.bounds.intersects(t.bounds)) {
                        queue.push([m, t], -m.bounds.intersection(t.bounds).area());
                    }
                    else if (Array.isArray(t) && m.bounds.contains(t)) {
                        queue.push([m, t], m.bounds.distance(t));
                    }
                }
                else {
                    if (t instanceof Node && t.bounds.contains(m)) {
                        queue.push([m, t], t.bounds.distance(m));
                    }
                    else if (Array.isArray(t) && m === t) {
                        queue.push([m, t], Math.hypot(m[0] - t[0], m[1] - t[1]));
                    }
                }
            }
        }
    }

    private priority(a: LatLngTuple | Node, b: LatLngTuple | Node): number {
        if (a instanceof Node && b instanceof Node) {
            return -a.bounds.intersection(b.bounds).area();
        }
        else if (a instanceof Node) {
            return a.bounds.distance(b as LatLngTuple);
        }
        else if (b instanceof Node) {
            return b.bounds.distance(a as LatLngTuple);
        }
        else {
            return Math.hypot(a[0] - b[0], a[1] - b[1]);
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
    private static distanceFn(a: LatLngTuple, b: LatLngTuple): number {
        return Math.hypot(a[0] - b[0], a[1] - b[1]);
    }

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

    public distance(point: LatLngTuple, distanceFn = Bounds.distanceFn): number {
        if (!this.isValid()) {
            return NaN;
        }
        else if (this.contains(point)) {
            return 0;
        }
        else if (point[0] > this.latMax) {
            if (point[1] < this.lonMin) {
                return distanceFn(point, [this.latMax, this.lonMin]);
            }
            else if (point[1] > this.lonMax) {
                return distanceFn(point, [this.latMax, this.lonMax]);
            }
            else {
                return distanceFn(point, [this.latMax, point[1]]);
            }
        }
        else if (point[0] < this.latMin) {
            if (point[1] < this.lonMin) {
                return distanceFn(point, [this.latMin, this.lonMin]);
            }
            else if (point[1] > this.lonMax) {
                return distanceFn(point, [this.latMin, this.lonMax]);
            }
            else {
                return distanceFn(point, [this.latMin, point[1]]);
            }
        }
        else {
            if (point[1] < this.lonMin) {
                return distanceFn(point, [point[0], this.lonMin]);
            } else {
                return distanceFn(point, [point[0], this.lonMax]);
            }
        }
    }

    public area(): number {
        if (!this.isValid()) {
            return NaN;
        }
        return Math.abs(this.latMax - this.latMin) * Math.abs(this.lonMax - this.lonMin);
    }

    public intersects(other: Bounds): boolean {
        return this.latMin <= other.latMax && other.latMin <= this.latMax
            && this.lonMin <= other.lonMax && other.lonMin <= this.lonMax;
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