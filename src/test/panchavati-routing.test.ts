import { describe, expect, it } from "vitest";

import {
  REPORT_LIFETIME_MS,
  activeReports,
  aggregateReports,
  buildRoadGraph,
  findWalkingRoute,
  isInsidePanchavati,
  scoreWalkingRoute,
  type OsmWay,
  type TrafficReport,
} from "@/lib/panchavati-routing";

const NOW = 1_800_000_000_000;

describe("Panchavati community navigation", () => {
  it("accepts traffic only inside the documented Panchavati reporting area", () => {
    expect(isInsidePanchavati(20.007, 73.792)).toBe(true);
    expect(isInsidePanchavati(20.007, 73.809)).toBe(false);
  });

  it("only treats reports less than two hours old as current traffic", () => {
    const reports: TrafficReport[] = [
      {
        id: "current",
        latitude: 20.007,
        longitude: 73.792,
        intensity: "heavy",
        createdAt: NOW - REPORT_LIFETIME_MS + 1,
        source: "community",
      },
      {
        id: "expired",
        latitude: 20.007,
        longitude: 73.792,
        intensity: "heavy",
        createdAt: NOW - REPORT_LIFETIME_MS,
        source: "community",
      },
    ];
    expect(activeReports(reports, NOW).map((report) => report.id)).toEqual(["current"]);
  });

  it("aggregates nearby reports without mixing community submissions with demo reports", () => {
    const reports: TrafficReport[] = [
      {
        id: "demo",
        latitude: 20.007,
        longitude: 73.792,
        intensity: "light",
        createdAt: NOW - 60_000,
        source: "demo",
      },
      {
        id: "community-a",
        latitude: 20.007,
        longitude: 73.792,
        intensity: "heavy",
        createdAt: NOW - 30_000,
        source: "community",
      },
      {
        id: "community-b",
        latitude: 20.0071,
        longitude: 73.792,
        intensity: "heavy",
        createdAt: NOW - 15_000,
        source: "community",
      },
    ];
    const clusters = aggregateReports(reports, NOW);
    expect(clusters).toHaveLength(2);
    expect(clusters.find((cluster) => cluster.source === "community")?.count).toBe(2);
    expect(clusters.find((cluster) => cluster.source === "demo")?.count).toBe(1);
  });

  it("uses fresh congestion as an A* road-edge cost and chooses the quieter path", () => {
    const ways: OsmWay[] = [
      {
        id: "fast-congested",
        name: "Temple Lane",
        highway: "residential",
        nodes: [
          ["start", 20.007, 73.790],
          ["busy", 20.007, 73.791],
          ["end", 20.007, 73.792],
        ],
      },
      {
        id: "quiet-detour",
        name: "Market Street",
        highway: "residential",
        nodes: [
          ["start", 20.007, 73.790],
          ["quiet-a", 20.008, 73.791],
          ["quiet-b", 20.008, 73.792],
          ["end", 20.007, 73.792],
        ],
      },
    ];
    const graph = buildRoadGraph(ways);
    const busyReports: TrafficReport[] = [
      {
        id: "busy-community",
        latitude: 20.007,
        longitude: 73.791,
        intensity: "heavy",
        createdAt: NOW - 60_000,
        source: "community",
      },
    ];
    const route = findWalkingRoute(graph, [20.007, 73.790], [20.007, 73.792], busyReports, NOW);
    expect(route?.nodeIds).toContain("quiet-a");
    expect(route?.nodeIds).not.toContain("busy");

    const clearRoute = findWalkingRoute(graph, [20.007, 73.790], [20.007, 73.792], [], NOW);
    expect(clearRoute?.nodeIds).toContain("busy");
  });

  it("penalizes a fresh reported intersection more than an unreported route", () => {
    const path = [
      [20.007, 73.790],
      [20.007, 73.792],
    ] as const;
    const reports: TrafficReport[] = [
      {
        id: "intersection",
        latitude: 20.007,
        longitude: 73.791,
        intensity: "heavy",
        createdAt: NOW - 60_000,
        source: "community",
      },
    ];
    expect(scoreWalkingRoute(path, reports, NOW).cost).toBeGreaterThan(
      scoreWalkingRoute(path, [], NOW).cost,
    );
  });
});