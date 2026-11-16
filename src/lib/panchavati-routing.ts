export type LatLng = readonly [latitude: number, longitude: number];
export type TrafficIntensity = "light" | "moderate" | "heavy";
export type ReportSource = "demo" | "community";

export interface TrafficReport {
  id: string;
  latitude: number;
  longitude: number;
  intensity: TrafficIntensity;
  createdAt: number;
  source: ReportSource;
  locationLabel?: string;
}

export interface OsmWay {
  id: string;
  name: string;
  highway: string;
  nodes: Array<[id: string, latitude: number, longitude: number]>;
}

export interface RoadNode {
  id: string;
  latitude: number;
  longitude: number;
}

export interface RoadEdge {
  to: string;
  distance: number;
  name: string;
}

export interface RoadGraph {
  nodes: Map<string, RoadNode>;
  edges: Map<string, RoadEdge[]>;
}

export interface ReportCluster {
  latitude: number;
  longitude: number;
  intensity: TrafficIntensity;
  source: ReportSource;
  count: number;
  newestAt: number;
  label?: string;
}

export interface WalkingRoute {
  coordinates: LatLng[];
  nodeIds: string[];
  distanceMeters: number;
  cost: number;
  reportCount: number;
}

export const REPORT_LIFETIME_MS = 120 * 60 * 1000;
const CLUSTER_RADIUS_METERS = 110;
const EDGE_REPORT_RADIUS_METERS = 130;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const earthRadius = 6_371_000;
  const radians = Math.PI / 180;
  const latitudeDelta = (b[0] - a[0]) * radians;
  const longitudeDelta = (b[1] - a[1]) * radians;
  const latitudeA = a[0] * radians;
  const latitudeB = b[0] * radians;
  const chord =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(Math.max(0, 1 - chord)));
}

export function isInsidePanchavati(latitude: number, longitude: number): boolean {
  return latitude >= 20.001 && latitude <= 20.018 && longitude >= 73.779 && longitude <= 73.808;
}

export function createDemoReports(now = Date.now()): TrafficReport[] {
  const demo = [
    [20.00705, 73.79447, "heavy", "Shabrichi Bol · sample"] as const,
    [20.00762, 73.79365, "moderate", "Kapad Bazaar · sample"] as const,
    [20.00594, 73.79291, "light", "Godavari Ghat approach · sample"] as const,
    [20.00902, 73.79592, "moderate", "Panchavati approach · sample"] as const,
    [20.00464, 73.79622, "heavy", "Dindori Road · sample"] as const,
  ];
  return demo.map(([latitude, longitude, intensity, locationLabel], index) => ({
    id: `demo-${index + 1}`,
    latitude,
    longitude,
    intensity,
    locationLabel,
    source: "demo",
    createdAt: now - [6, 17, 32, 48, 70][index] * 60_000,
  }));
}

export function activeReports(reports: TrafficReport[], now: number): TrafficReport[] {
  return reports.filter((report) => {
    const age = now - report.createdAt;
    return age >= 0 && age < REPORT_LIFETIME_MS;
  });
}

function reportSeverity(intensity: TrafficIntensity): number {
  if (intensity === "heavy") return 2.5;
  if (intensity === "moderate") return 1.15;
  return 0.3;
}

function reportFreshness(report: TrafficReport, now: number): number {
  return Math.max(0, 1 - (now - report.createdAt) / REPORT_LIFETIME_MS);
}

function clusterIntensity(reports: TrafficReport[], now: number): TrafficIntensity {
  const total = reports.reduce(
    (sum, report) => sum + reportSeverity(report.intensity) * reportFreshness(report, now),
    0,
  );
  const average = total / reports.length;
  if (average >= 1.65) return "heavy";
  if (average >= 0.72) return "moderate";
  return "light";
}

export function aggregateReports(reports: TrafficReport[], now: number): ReportCluster[] {
  const groups: Array<{ source: ReportSource; reports: TrafficReport[] }> = [];
  const newestFirst = activeReports(reports, now).sort((a, b) => b.createdAt - a.createdAt);

  for (const report of newestFirst) {
    const existing = groups.find(
      (group) =>
        group.source === report.source &&
        group.reports.some(
          (other) =>
            haversineMeters(
              [report.latitude, report.longitude],
              [other.latitude, other.longitude],
            ) <= CLUSTER_RADIUS_METERS,
        ),
    );
    if (existing) existing.reports.push(report);
    else groups.push({ source: report.source, reports: [report] });
  }

  return groups.map(({ source, reports: group }) => {
    const first = group[0];
    if (!first) return undefined;
    const newestAt = Math.max(...group.map((report) => report.createdAt));
    return {
      latitude: group.reduce((sum, report) => sum + report.latitude, 0) / group.length,
      longitude: group.reduce((sum, report) => sum + report.longitude, 0) / group.length,
      intensity: clusterIntensity(group, now),
      source,
      count: group.length,
      newestAt,
      ...(first.locationLabel ? { label: first.locationLabel } : {}),
    };
  }).filter((cluster): cluster is ReportCluster => cluster !== undefined);
}

export function buildRoadGraph(ways: OsmWay[]): RoadGraph {
  const nodes = new Map<string, RoadNode>();
  const edges = new Map<string, RoadEdge[]>();

  for (const way of ways) {
    for (const [id, latitude, longitude] of way.nodes) {
      nodes.set(id, { id, latitude, longitude });
      if (!edges.has(id)) edges.set(id, []);
    }

    for (let index = 1; index < way.nodes.length; index += 1) {
      const previous = way.nodes[index - 1];
      const current = way.nodes[index];
      if (!previous || !current || previous[0] === current[0]) continue;
      const distance = haversineMeters([previous[1], previous[2]], [current[1], current[2]]);
      const forward = edges.get(previous[0]);
      const backward = edges.get(current[0]);
      if (forward) forward.push({ to: current[0], distance, name: way.name });
      if (backward) backward.push({ to: previous[0], distance, name: way.name });
    }
  }

  return { nodes, edges };
}

class MinHeap {
  private items: Array<{ id: string; priority: number }> = [];

  push(item: { id: string; priority: number }): void {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentItem = this.items[parent];
      const current = this.items[index];
      if (!parentItem || !current || parentItem.priority <= current.priority) break;
      this.items[index] = parentItem;
      this.items[parent] = current;
      index = parent;
    }
  }

  pop(): { id: string; priority: number } | undefined {
    const first = this.items[0];
    const last = this.items.pop();
    if (!first || !last) return first;
    if (this.items.length === 0) return first;
    this.items[0] = last;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      const leftItem = this.items[left];
      const smallestItem = this.items[smallest];
      if (leftItem && smallestItem && leftItem.priority < smallestItem.priority) {
        smallest = left;
      }
      const rightItem = this.items[right];
      const currentSmallest = this.items[smallest];
      if (rightItem && currentSmallest && rightItem.priority < currentSmallest.priority) {
        smallest = right;
      }
      if (smallest === index) break;
      const item = this.items[index];
      const smaller = this.items[smallest];
      if (!item || !smaller) break;
      this.items[index] = smaller;
      this.items[smallest] = item;
      index = smallest;
    }
    return first;
  }
}

function nearestNode(graph: RoadGraph, point: LatLng): RoadNode | undefined {
  let nearest: RoadNode | undefined;
  let shortest = Number.POSITIVE_INFINITY;
  for (const node of graph.nodes.values()) {
    const distance = haversineMeters(point, [node.latitude, node.longitude]);
    if (distance < shortest) {
      shortest = distance;
      nearest = node;
    }
  }
  return shortest <= 1000 ? nearest : undefined;
}

function congestionCost(
  a: RoadNode,
  b: RoadNode,
  reports: TrafficReport[],
  now: number,
): { multiplier: number; count: number } {
  const midpoint: LatLng = [(a.latitude + b.latitude) / 2, (a.longitude + b.longitude) / 2];
  let penalty = 0;
  let count = 0;
  for (const report of activeReports(reports, now)) {
    if (
      haversineMeters(midpoint, [report.latitude, report.longitude]) > EDGE_REPORT_RADIUS_METERS
    ) {
      continue;
    }
    count += 1;
    penalty += reportSeverity(report.intensity) * reportFreshness(report, now);
  }
  return { multiplier: 1 + Math.min(8, penalty), count };
}

export function findWalkingRoute(
  graph: RoadGraph,
  start: LatLng,
  destination: LatLng,
  reports: TrafficReport[],
  now: number,
  blockedEdges: Set<string> = new Set(),
): WalkingRoute | undefined {
  const startNode = nearestNode(graph, start);
  const endNode = nearestNode(graph, destination);
  if (!startNode || !endNode) return undefined;
  if (startNode.id === endNode.id) {
    return {
      coordinates: [[startNode.latitude, startNode.longitude]],
      nodeIds: [startNode.id],
      distanceMeters: haversineMeters(start, destination),
      cost: 0,
      reportCount: 0,
    };
  }

  const open = new MinHeap();
  const cameFrom = new Map<string, string>();
  const costs = new Map<string, number>([[startNode.id, 0]]);
  const closed = new Set<string>();
  open.push({ id: startNode.id, priority: 0 });
  let found = false;

  while (true) {
    const current = open.pop();
    if (!current) break;
    if (closed.has(current.id)) continue;
    if (current.id === endNode.id) {
      found = true;
      break;
    }
    closed.add(current.id);
    const currentNode = graph.nodes.get(current.id);
    if (!currentNode) continue;

    for (const edge of graph.edges.get(current.id) ?? []) {
      if (blockedEdges.has(`${current.id}:${edge.to}`)) continue;
      if (closed.has(edge.to)) continue;
      const neighbor = graph.nodes.get(edge.to);
      if (!neighbor) continue;
      const risk = congestionCost(currentNode, neighbor, reports, now);
      const nextCost = (costs.get(current.id) ?? Number.POSITIVE_INFINITY) + edge.distance * risk.multiplier;
      if (nextCost >= (costs.get(edge.to) ?? Number.POSITIVE_INFINITY)) continue;
      costs.set(edge.to, nextCost);
      cameFrom.set(edge.to, current.id);
      const heuristic = haversineMeters(
        [neighbor.latitude, neighbor.longitude],
        [endNode.latitude, endNode.longitude],
      );
      open.push({ id: edge.to, priority: nextCost + heuristic });
    }
  }

  if (!found) return undefined;
  const pathIds = [endNode.id];
  let cursor = endNode.id;
  while (cursor !== startNode.id) {
    const previous = cameFrom.get(cursor);
    if (!previous) return undefined;
    pathIds.push(previous);
    cursor = previous;
  }
  pathIds.reverse();

  const coordinates: LatLng[] = pathIds.flatMap((id) => {
    const node = graph.nodes.get(id);
    return node ? [[node.latitude, node.longitude] as LatLng] : [];
  });
  const distanceMeters = pathIds.slice(1).reduce((sum, id, index) => {
    const previous = graph.nodes.get(pathIds[index] ?? "");
    const current = graph.nodes.get(id);
    return previous && current
      ? sum + haversineMeters([previous.latitude, previous.longitude], [current.latitude, current.longitude])
      : sum;
  }, haversineMeters(start, [startNode.latitude, startNode.longitude]) + haversineMeters(destination, [endNode.latitude, endNode.longitude]));
  const reportCount = countReportsNearPath(coordinates, reports, now);

  return {
    coordinates,
    nodeIds: pathIds,
    distanceMeters,
    cost: costs.get(endNode.id) ?? distanceMeters,
    reportCount,
  };
}

export function routeToTrafficReports(reports: TrafficReport[], now: number) {
  return {
    community: aggregateReports(
      reports.filter((report) => report.source === "community"),
      now,
    ),
    demo: aggregateReports(reports.filter((report) => report.source === "demo"), now),
  };
}

export function countReportsNearPath(path: LatLng[], reports: TrafficReport[], now: number): number {
  return activeReports(reports, now).filter((report) =>
    path.some(
      (point) => haversineMeters(point, [report.latitude, report.longitude]) <= 150,
    ),
  ).length;
}

export function scoreWalkingRoute(
  path: LatLng[],
  reports: TrafficReport[],
  now: number,
): { cost: number; reportCount: number } {
  const currentReports = activeReports(reports, now);
  let cost = 0;
  let reportCount = 0;

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    if (!previous || !current) continue;
    const segmentDistance = haversineMeters(previous, current);
    const midpoint: LatLng = [
      (previous[0] + current[0]) / 2,
      (previous[1] + current[1]) / 2,
    ];
    let penalty = 0;
    for (const report of currentReports) {
      if (
        haversineMeters(midpoint, [report.latitude, report.longitude]) > EDGE_REPORT_RADIUS_METERS
      ) {
        continue;
      }
      reportCount += 1;
      penalty += reportSeverity(report.intensity) * reportFreshness(report, now);
    }
    cost += segmentDistance * (1 + Math.min(8, penalty));
  }

  return { cost, reportCount };
}
