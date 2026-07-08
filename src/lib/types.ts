export type RouteType = "loop" | "point_to_point";
export type LocationFamiliarity = "familiar" | "new" | "no_preference";
export type Terrain = "flat" | "slightly_hilly" | "hilly";
export type Environment = "nature_parks" | "waterfront" | "city_streets" | "landmarks" | "running_paths";
export type Traffic = "avoid" | "balanced" | "fastest";
export type Safety = "lowest" | "balanced" | "prioritise";
export type Scenery = "scenery" | "balanced" | "efficiency";
export type Hydration = "not_required" | "some" | "frequent";
export type Toilet = "not_required" | "some" | "frequent";
export type Shade = "no_preference" | "some" | "prioritise";
export type Timing = "morning" | "afternoon" | "evening" | "night";

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RunPreferences {
  terrain: Terrain;
  environment: Environment[];
  traffic: Traffic;
  safety: Safety;
  scenery: Scenery;
  hydration: Hydration;
  toilet: Toilet;
  shade: Shade;
  timing: Timing;
}

export interface CreateRunRequest {
  startLat: number;
  startLng: number;
  startLabel?: string;
  locationFamiliarity: LocationFamiliarity;
  distanceKm: number;
  routeType: RouteType;
  preferences: RunPreferences;
  userId?: string;
}

export interface FacilityPoint {
  km: number;
  name: string;
  lat: number;
  lng: number;
  subtype?: string;
}

export interface WeatherSummary {
  tempC: number | null;
  rainProbability: number | null; // 0-100
  heatWarning: boolean;
  rainWarning: boolean;
  source: "open-meteo" | "unavailable";
}

export interface RouteScores {
  safetyScore: number;
  sceneryScore: number;
  trafficScore: number;
  convenienceScore: number;
  shadeScore: number;
  weatherProtectionScore: number;
  overallScore: number;
}

export interface TerrainProfile {
  elevationGainM: number;
  highestPointM: number;
  maxInclinePct: number;
  difficulty: "easy" | "moderate" | "hard";
  isEstimated: boolean;
}

export interface RouteCandidate {
  id: string;
  name: string;
  geojson: GeoJSON.Feature<GeoJSON.LineString>;
  distanceKm: number;
  estimatedDurationMin: number;
  routeType: RouteType;
  terrain: TerrainProfile;
  scores: RouteScores;
  hydrationPoints: FacilityPoint[];
  toiletPoints: FacilityPoint[];
  shelterPoints: FacilityPoint[];
  weatherSummary: WeatherSummary;
  explanation: string;
  recommendation: string | null;
  source: "openrouteservice" | "synthetic";
}
