import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Demo facilities around Singapore (matches the spec's own examples:
// Rail Corridor, MRT stations, malls). Swap/extend freely — real facility
// data is normally pulled live from Overpass in src/lib/facilities.ts;
// these seed rows just give the DB + PostGIS query something to return
// immediately, with zero external API calls, for demoing.
const facilities = [
  { type: "hydration", subtype: "drinking_water", name: "Bishan Park water point", lat: 1.3526, lng: 103.8352 },
  { type: "hydration", subtype: "cafe", name: "Coffee stall, Rail Corridor", lat: 1.3399, lng: 103.8109 },
  { type: "hydration", subtype: "convenience_store", name: "7-Eleven, Holland Village", lat: 1.3113, lng: 103.7961 },
  { type: "toilet", subtype: "park", name: "East Coast Park public toilet", lat: 1.3013, lng: 103.9124 },
  { type: "toilet", subtype: "mall", name: "Toilet, Tanglin Mall", lat: 1.3067, lng: 103.8163 },
  { type: "toilet", subtype: "mrt_station", name: "Toilet, Botanic Gardens MRT", lat: 1.3223, lng: 103.8153 },
  { type: "shelter", subtype: "covered_walkway", name: "Covered walkway, Rail Corridor", lat: 1.3308, lng: 103.8138 },
  { type: "shelter", subtype: "mall", name: "Great World City", lat: 1.2939, lng: 103.8322 },
  { type: "shelter", subtype: "mrt_station", name: "Redhill MRT shelter", lat: 1.2896, lng: 103.8168 },
  { type: "shelter", subtype: "park_shelter", name: "Shelter, Bishan-Ang Mo Kio Park", lat: 1.3616, lng: 103.8395 },
];

async function main() {
  console.log(`Seeding ${facilities.length} demo facilities...`);
  for (const f of facilities) {
    await prisma.facility.create({ data: { ...f, source: "seed" } });
  }
  console.log("Done. Run prisma/postgis.sql next to enable spatial search.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
