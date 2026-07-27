// All user preferences are fixed dropdowns/multi-select — no free text,
// per spec ("Do NOT allow free-text preference input").

export const DISTANCE_OPTIONS_KM = [3, 5, 10, 15, 20] as const;

export const ROUTE_TYPES = [
  { value: "loop", label: "Loop route", hint: "Start and end at the same location" },
  { value: "point_to_point", label: "Point-to-point route", hint: "Start and end at different locations" },
] as const;

export const LOCATION_FAMILIARITY = [
  { value: "familiar", label: "Familiar area" },
  { value: "new", label: "New area" },
  { value: "no_preference", label: "No preference" },
] as const;

export const TERRAIN_OPTIONS = [
  { value: "flat", label: "Flat" },
  { value: "slightly_hilly", label: "Slightly hilly" },
  { value: "hilly", label: "Hilly" },
] as const;

export const ENVIRONMENT_OPTIONS = [
  { value: "nature_parks", label: "Nature / Parks" },
  { value: "waterfront", label: "Waterfront" },
  { value: "city_streets", label: "City Streets" },
  { value: "landmarks", label: "Landmarks / Sightseeing" },
  { value: "running_paths", label: "Dedicated Running Paths" },
] as const;

export const TRAFFIC_OPTIONS = [
  { value: "avoid", label: "Avoid traffic as much as possible" },
  { value: "balanced", label: "Balanced" },
  { value: "fastest", label: "Fastest route" },
] as const;

export const SAFETY_OPTIONS = [
  { value: "lowest", label: "Lowest priority" },
  { value: "balanced", label: "Balanced" },
  { value: "prioritise", label: "Prioritise safety" },
] as const;

export const SCENERY_OPTIONS = [
  { value: "scenery", label: "Prioritise scenery" },
  { value: "balanced", label: "Balanced" },
  { value: "efficiency", label: "Prioritise efficiency" },
] as const;

export const HYDRATION_OPTIONS = [
  { value: "not_required", label: "Not required" },
  { value: "some", label: "Some hydration points" },
  { value: "frequent", label: "Frequent hydration points" },
] as const;

export const TOILET_OPTIONS = [
  { value: "not_required", label: "Not required" },
  { value: "some", label: "Some toilet access" },
  { value: "frequent", label: "Frequent toilet access" },
] as const;

export const SHADE_OPTIONS = [
  { value: "no_preference", label: "No preference" },
  { value: "some", label: "Some shaded sections" },
  { value: "prioritise", label: "Prioritise shaded routes" },
] as const;

export const TIMING_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
] as const;

export const DEFAULT_LAT = Number(process.env.NEXT_PUBLIC_DEFAULT_LAT ?? 1.3048);
export const DEFAULT_LNG = Number(process.env.NEXT_PUBLIC_DEFAULT_LNG ?? 103.8318);
