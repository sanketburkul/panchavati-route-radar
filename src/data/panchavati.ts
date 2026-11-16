export type LandmarkKind = "sacred" | "ghat";

export interface Landmark {
  id: string;
  name: string;
  category: string;
  position: [latitude: number, longitude: number];
  kind: LandmarkKind;
}

export const START_LANDMARK_ID = "ramkund";

export const PANCHAVATI_CENTER: [number, number] = [20.0072639, 73.7924901];

export const LANDMARKS: Landmark[] = [
  {
    id: "ramkund",
    name: "Ramkund",
    category: "Sacred bathing ghat",
    position: [20.0072639, 73.7924901],
    kind: "ghat",
  },
  {
    id: "kalaram",
    name: "Kalaram Temple",
    category: "Temple",
    position: [20.00695, 73.7952193],
    kind: "sacred",
  },
  {
    id: "kapaleshwar",
    name: "Kapaleshwar Temple",
    category: "Temple",
    position: [20.0082828, 73.7931596],
    kind: "sacred",
  },
  {
    id: "sitagufa",
    name: "Sita Gufa",
    category: "Sacred cave",
    position: [20.0077229, 73.7961612],
    kind: "sacred",
  },
  {
    id: "godavari",
    name: "Godavari Ghats",
    category: "Riverside bathing ghats",
    position: [20.006437, 73.7926664],
    kind: "ghat",
  },
];

export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
export const INDIA_EMERGENCY_NUMBER = "112";