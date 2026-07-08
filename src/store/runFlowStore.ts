import { create } from "zustand";
import { DEFAULT_LAT, DEFAULT_LNG } from "@/lib/constants";
import type { CreateRunRequest, LocationFamiliarity, RouteCandidate, RouteType, RunPreferences } from "@/lib/types";

const DEFAULT_PREFERENCES: RunPreferences = {
  terrain: "flat",
  environment: [],
  traffic: "balanced",
  safety: "balanced",
  scenery: "balanced",
  hydration: "some",
  toilet: "some",
  shade: "no_preference",
  timing: "morning",
};

interface RunFlowState {
  startLat: number;
  startLng: number;
  startLabel: string;
  locationFamiliarity: LocationFamiliarity;
  distanceKm: number;
  routeType: RouteType;
  preferences: RunPreferences;

  runId: string | null;
  routes: RouteCandidate[] | any[]; // RouteOption[] once persisted (Prisma shape) or RouteCandidate[]
  sessionId: string | null;

  setLocation: (lat: number, lng: number, label: string) => void;
  setFamiliarity: (f: LocationFamiliarity) => void;
  setDistanceKm: (km: number) => void;
  setRouteType: (t: RouteType) => void;
  setPreferences: (p: Partial<RunPreferences>) => void;
  toggleEnvironment: (env: RunPreferences["environment"][number]) => void;
  setGenerated: (runId: string, routes: any[]) => void;
  setSessionId: (id: string | null) => void;
  toCreateRunRequest: () => CreateRunRequest;
  reset: () => void;
}

export const useRunFlowStore = create<RunFlowState>((set, get) => ({
  startLat: DEFAULT_LAT,
  startLng: DEFAULT_LNG,
  startLabel: "Current location",
  locationFamiliarity: "no_preference",
  distanceKm: 5,
  routeType: "loop",
  preferences: DEFAULT_PREFERENCES,

  runId: null,
  routes: [],
  sessionId: null,

  setLocation: (lat, lng, label) => set({ startLat: lat, startLng: lng, startLabel: label }),
  setFamiliarity: (locationFamiliarity) => set({ locationFamiliarity }),
  setDistanceKm: (distanceKm) => set({ distanceKm }),
  setRouteType: (routeType) => set({ routeType }),
  setPreferences: (p) => set((s) => ({ preferences: { ...s.preferences, ...p } })),
  toggleEnvironment: (env) =>
    set((s) => {
      const has = s.preferences.environment.includes(env);
      return {
        preferences: {
          ...s.preferences,
          environment: has ? s.preferences.environment.filter((e) => e !== env) : [...s.preferences.environment, env],
        },
      };
    }),
  setGenerated: (runId, routes) => set({ runId, routes }),
  setSessionId: (sessionId) => set({ sessionId }),
  toCreateRunRequest: () => {
    const s = get();
    return {
      startLat: s.startLat,
      startLng: s.startLng,
      startLabel: s.startLabel,
      locationFamiliarity: s.locationFamiliarity,
      distanceKm: s.distanceKm,
      routeType: s.routeType,
      preferences: s.preferences,
    };
  },
  reset: () => set({ runId: null, routes: [], sessionId: null }),
}));
